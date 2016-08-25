'use strict';

/**
 * Module dependencies.
 */
var redis = require('redis');
var redisCommands = require('redis-commands').list;
var Pool = require('generic-pool').Pool;
// var debug = require('debug')('redis-pool');
var poolNumber = 0;

/**
 * Expose redis-pool
 */
exports.RedisPool = RedisPool;
exports.createClient = function (options) {
  options = options || {};
  return new RedisPool(options);
};

/**
 * Initialize redis connection pool with `options`:
 *
 * - `uid` pool indentifier prefix [`'redis-pool-'`]
 * - `host` host name  / IP address of server [`'127.0.0.1'`]
 * - `port` port number of server [6379]
 * - `unixSocket` path to the unix socket on local machine (overrides host & port when set) [null]
 * - `maxClients` max. number of client connections for this pool [100]
 * - `idleTimeOut` timeout in ms for connections before being closed (will be reopened on new request [3600000 = 1h]
 * - `closeIdle` close idle connections after idleTimeOut [true]
 * - `options` additional options to be passed to redis (e.g. auth) [null]
 * - `database` number of database on server this pool connects to [0]
 *
 * @param {Object} options
 * @return {Object}
 * @api public
 */

function RedisPool (options) {
  options = options || {};
  this.opts = {};
  this.opts.uid = (options.uid || 'redis-pool-') + (poolNumber++);
  this.opts.host = options.host || '127.0.0.1';
  this.opts.port = options.port || 6379;
  this.opts.unixSocket = options.unixSocket || null;
  this.opts.maxClients = options.maxClients || 100;
  this.opts.closeIdle = typeof options.closeIdle !== 'undefined' ? options.closeIdle : true;
  this.opts.idleTimeOut = options.idleTimeOut || 3600000;
  this.opts.options = options.options || {};
  this.opts.database = options.database || 0;

  // Prevent double setting of certain values
  if (this.opts.options.hasOwnProperty('db')) { delete this.opts.options.db; }
  if (this.opts.options.hasOwnProperty('host')) { delete this.opts.options.host; }
  if (this.opts.options.hasOwnProperty('port')) { delete this.opts.options.port; }
  if (this.opts.options.hasOwnProperty('path')) { delete this.opts.options.path; }
  if (this.opts.options.hasOwnProperty('url')) { delete this.opts.options.url; }
  if (this.opts.options.hasOwnProperty('db')) {
    this.opts.database = this.opts.options.db;
    delete this.opts.options.db;
  }

  this._pool = new Pool({
    name: this.opts.uid,
    create: (callback) => {
      // Create a new connection to redis
      var client = this.opts.unixSocket !== null ? redis.createClient(this.opts.unixSocket, this.opts.options) : redis.createClient(this.opts.port, this.opts.host, this.opts.options);

      client.on('error', (err) => {
        // Can't establish connection to reddit, abort
        callback(err, null);
      });

      client.on('ready', () => {
        // Connection established, select correct database
        // debug('Connection established');

        client.select(this.opts.database, (err, res) => {
          // Check if failed to select database
          if (err) return callback(err, null);

          // Database selected
          // debug('Database selected: ' + this.opts.database);
          callback(null, client);
        });
      });
    },
    destroy: (client) => {
      client.quit();
      // debug('Connection closed');
    },
    max: this.opts.maxClients,
    idleTimeoutMillis: this.opts.idleTimeOut,
    refreshIdle: this.opts.closeIdle,
    log: false
  });

  return this;
}

// Function to poolify + promisify redis
var poolPromisify = function (cmd) {
  // Generate a function that will get a pool connection, run the command and return the connection to the pool
  return function () {
    // Get arguments passed in (= values sent to redis)
    var args = Array.prototype.slice.call(arguments);

    // Check if caller provided a callback as an argument (old library, etc.)
    if (typeof args[args.length - 1] === 'function') {
      // Old-style call - preserve callback and delete it from arguments
      var cb = args[args.length - 1];
      args.pop();

      // Get connection from pool
      this._pool.acquire((err, client) => {
        // Return error if connection cannot be aquired
        if (err) return cb(err, null);
        // debug('Connection aquired');

        // Prepare new callback to release the connection
        args.push((err, res) => {
          // Release connection back to pool
          this._pool.release(client);
          // debug('Connection released');

          // Run client-supplied callbacks with the values received from redis, error and result
          cb(err, typeof res !== 'undefined' ? res : null);
        });

        // Run redis command
        client[cmd].apply(client, args);
      });
    } else {
      // The function returns a promise in that case
      return new Promise((resolve, reject) => {
        // Get connection from pool
        this._pool.acquire((err, client) => {
          // Return error if connection cannot be aquired
          if (err) return reject(err);
          // debug('Connection aquired');

          // Prepare new callback to release the connection
          args.push((err, res) => {
            // Release connection back to pool
            this._pool.release(client);
            // debug('Connection released');

            // Resolve / reject promise
            if (err) return reject(err);
            resolve(res);
          });

          // Run redis command
          client[cmd].apply(client, args);
        });
      });
    }
  };
};

// Attach redis commands to the pool
(function () {
  // Attach all singular commands
  redisCommands.forEach((fullCmd) => {
    var cmd = fullCmd.split(' ')[0];

    if (cmd !== 'multi') {
      // debug('Attaching command: ' + cmd);
      RedisPool.prototype[cmd] = poolPromisify(cmd);
      RedisPool.prototype[cmd.toUpperCase()] = RedisPool.prototype[cmd];
    }
  });

  // Attach the "multi" command
  RedisPool.prototype.multi = RedisPool.prototype.MULTI = function multi (args) {
    var multi = new redis.Multi(null, args);
    multi._pool = this._pool;
    multi.exec = multi.EXEC = function (cb) {
      // debug('Called multi - execute');

      if (typeof cb === 'function') {
        // User supplied an actual callback, instead of expecting a promise

        this._pool.acquire((err, client) => {
          // Return error if connection cannot be aquired
          if (err) return cb(err, null);
          // debug('Connection aquired');

          // "this" is multi at this point
          this._client = client;

          // Call the original multi exec function
          // debug('Executing multi - exec_transaction (callback)');
          this.exec_transaction((err, res) => {
            // Release connection
            this._pool.release(this._client);
            // debug('Connection released');

            // Call user supplied an actual callback
            cb(err, typeof res !== 'undefined' ? res : null);
          });
        });
      } else {
        // User expects a promise
        return new Promise((resolve, reject) => {
          this._pool.acquire((err, client) => {
            // Return error if connection cannot be aquired
            if (err) return reject(err, null);
            // debug('Connection aquired');

            // "this" is multi at this point
            this._client = client;

            // Call the original multi exec function
            // debug('Executing multi - exec_transaction (promise)');
            this.exec_transaction((err, res) => {
              // Release connection
              this._pool.release(this._client);
              // debug('Connection released');

              // Resolve / reject the promise
              if (err) return reject(err);
              resolve(res);
            });
          });
        });
      }
    };

    // debug('Returning multi object to client');
    return multi;
  };
})();
