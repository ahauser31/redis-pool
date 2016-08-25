var redis = require('./');

// create pool
var db = redis.createClient(); // Connects with redis on 127.0.0.1:6379

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
