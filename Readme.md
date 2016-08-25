
# redis-pool

 Redis connection pool with native promise support

## Installation

```js
$ npm install git+ssh://git@github.com/ahauser31/redis-pool.git
```

## Usage

  This library is based on node-redis and as such supports most of the libraries functions and can (almost) serve as a drop-in replacement.
  For specific commands, please see the node-redis project.
  Commands accept a callback (for compatability with libraries such as `ratelimit`) and will return a promise if no callback was provided.
  New connections will be established automatically when they are required; the user does not have to do anything.

## Important note

  Currently, testing was only done for standard functions (get, set, del, keys, etc.).
  `multi` is supported.
  Advanced functionality (`subscribe`, etc.) is not tested and unlikely to work.
  If you find that any function does not work, please let me know in the issues.

## Example

```js
var RedisPool = require('redis-pool');

// create pool
var db = new RedisPool(); // Connects with redis on 127.0.0.1:6379

// write a value to redis and read it back
db.set('foo', 'bar').then( (res) => {
	console.log(res);
}).catch( (err) => {
	console.log('Error!');
	console.log(res);
});

db.get('foo', (err, res) => {
  if (err) {
	console.log('Error!');
	console.log(err);
  }
  
  console.log(res);
});
```

## Example output

```
OK
bar
```

## Options
 
 - `uid` pool indentifier prefix [`'redis-pool-'`]
 - `host` host name  / IP address of server [`'127.0.0.1'`]
 - `port` port number of server [6379]
 - `unixSocket` path to the unix socket on local machine (overrides host & port when set) [null]
 - `maxClients` max. number of client connections for this pool [100]
 - `idleTimeOut` timeout in ms for connections before being closed (will be reopened on new request [3600000 = 1h]
 - `closeIdle` close idle connections after idleTimeOut [true]
 - `options` additional options to be passed to redis (e.g. auth) [null]
 - `database` number of database on server this pool connects to [0]

## License

  MIT
