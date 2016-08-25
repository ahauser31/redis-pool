var expect     = require('chai').expect;
var redis = require('..');
var redisVanilla = require('redis');

describe('Redis connection pooling', function() {

  before(function(done) {
    // Using the vanilla redis client here to prevent bugs of this script to interfere with the db prep
    var db = redisVanilla.createClient();
    db.keys('pool:*', function(err, keys) {
      if (err) return done(err);
      if (!keys.length) return done();
      var args = keys.concat(done);
      db.del.apply(db, args);
    });
  });

  describe('single connection, using promises', function() {
    var db = redis.createClient();

    // beforeEach(function(done) {
    //   done();
    // });

    it('it writes a value to the db', function(done) {
      db.set('pool:foo', 'bar').then( (res) => {
        expect(res).to.equal('OK');
        done();
      }).catch( (err) => {
        done(err);
      });
    });

    it('it reads a value from the db', function(done) {
      db.get('pool:foo').then( (res) => {
        expect(res).to.equal('bar');
        done();
      }).catch( (err) => {
        done(err);
      });
    });

    it('it deletes a value from the db and checks that it is gone', function(done) {
      db.del('pool:foo').then( (res) => {
        expect(res).to.equal(1);
        db.get('pool:foo').then( (res) => {
          expect(res).to.equal(null);
          done();
        }).catch( (err) => {
          done(err);
        });
      }).catch( (err) => {
        done(err);
      });
    });

    it('it uses multi to set two values', function(done) {
      db.multi().set('pool:multiFoo1', 'bar1').set('pool:multiFoo2', 'bar2').exec().then((res) => {
        expect(res).to.have.members(['OK', 'OK']);

        db.multi().get('pool:multiFoo1').get('pool:multiFoo2').exec().then((res) => {
          expect(res).to.have.members(['bar1', 'bar2']);

          db.multi().del('pool:multiFoo1').del('pool:multiFoo2').exec().then((res) => {
            expect(res).to.have.members([1, 1]);
            done();
          }).catch((err) => {
            done(err);
          });

        }).catch((err) => {
          done(err);
        });
      }).catch((err) => {
        done(err);
      });
    });
    
  });

  describe('single connection, using callbacks', function() {
    var db = redis.createClient();

    // beforeEach(function(done) {
    //   done();
    // });

    it('it writes a value to the db', function (done) {
      db.set('pool:foo', 'bar', (err, res) => {
        if (err) return done(err);
        expect(res).to.equal('OK');
        done();
      });
    });

    it('it reads a value from the db', function (done) {
      db.get('pool:foo', (err, res) => {
        if (err) return done(err);
        expect(res).to.equal('bar');
        done();
      });
    });

    it('it deletes a value from the db and checks that it is gone', function (done) {
      db.del('pool:foo', (err, res) => {
        if (err) return done(err);

        expect(res).to.equal(1);

        db.get('pool:foo', (err, res) => {
          if (err) return done(err);
          expect(res).to.equal(null);
          done();
        });

      });
    });

    it('it uses multi to set two values', function(done) {
      db.multi().set('pool:multiFoo1', 'bar1').set('pool:multiFoo2', 'bar2').exec( (err, res) => {
        if (err) return done(err);
        expect(res).to.have.members(['OK', 'OK']);

        db.multi().get('pool:multiFoo1').get('pool:multiFoo2').exec( (err, res) => {
          if (err) return done(err);
          expect(res).to.have.members(['bar1', 'bar2']);

          db.multi().del('pool:multiFoo1').del('pool:multiFoo2').exec((err, res) => {
            if (err) return done(err);
            expect(res).to.have.members([1, 1]);
            done();
          });
        });
      });
    });

  });

});
