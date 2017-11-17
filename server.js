var User = require('./database.js').User;
var express = require('express');
var app = express();
var path = require('path');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var flash = require('connect-flash');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var bodyParser = require('body-parser');
var validator = require('express-validator');
var bcrypt   = require('bcrypt-nodejs');
var mongoose = require('mongoose');
var Mongostore = require('connect-mongo')(session);
var config = require('./auth.js');
var ejs = require('ejs');
var request = require('request');
var zomato = require('zomato');

//ZOMATO 

//middleware
app.set('view engine','ejs');
app.use(express.static(path.join(__dirname,'public')));
app.use(bodyParser.json());
app.use(session(
{
secret:'iamkartik',
store: new Mongostore(
{url:'mongodb://localhost/fastfood_database',
ttl:14*24*60*60}),
resave: false ,
saveUninitialized: false
}));
app.use(passport.initialize());
app.use(passport.session()); 
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(validator());
passport.use(new LocalStrategy(function(username,password,done){
	User.findOne({'Local.Username':username},function(err,user){
		if(err){
			return done(err); //try using promise
			//console.log('err');
		}
		if(!user){
			return done(null, false, { message: 'Incorrect username or password.' });
		}
		bcrypt.compare(password, user.Local.Password, function(err, result) {
         if(err)
		 {
			 console.log(err);
		 }
		 if(result){
			return done(null, user); 
		 }
		 return done(null, false, { message: 'Incorrect username or password.' });
		});
		
	})
}));


passport.use(new FacebookStrategy({
    clientID: config.facebook.clientID,
    clientSecret: config.facebook.clientSecret,
    callbackURL: config.facebook.callbackURL,
	profileFields: ['email','first_name','last_name']
  },
  function(token, refreshToken, profile, done) {
        process.nextTick(function() {
            User.findOne({ 'Facebook.id' : profile.id }, function(err, user) {
                if (err)
                    return done('err');
                if (user) {
                    return done(null, user);
                } else {
                    var newUser = new User();
					console.log(profile);
                    newUser.Facebook.id    = profile.id;                  
                    newUser.Facebook.token = token;                    
                    newUser.Facebook.name  = profile.name.givenName + ' ' + profile.name.familyName;
                    newUser.Facebook.email = profile.emails[0].value;
                    newUser.save(function(err) {
                        if (err)
                            throw err;
                        return done(null, newUser);
                    });
                }
			}
			)});
		}));
passport.serializeUser(function(user, done) {  
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});


//routes
app.get('/',function(req,res){
	res.sendFile(__dirname+'/client/homepage.html');
});

app.get('/profile/:name',isLoggedIn,function(req,res){
	res.sendFile(__dirname+'/client/home_login.html');
})

app.get('/register',function(req,res){
	res.sendFile(__dirname+'/client/register.html');
})

app.post('/register',function(req,res){
	req.checkBody('name','enter your name');
	req.checkBody('username','enter your Username');
	req.checkBody('email','enter your Email').isEmail();
	req.checkBody('password','enter your Password');
	
	var errors = req.validationErrors();
	if(errors)
	{
		res.send(errors)
	}
	else{
		var new_user = User();
		new_user.Local.Name = req.body.name;
		new_user.Local.Email = req.body.email;
		new_user.Local.Username = req.body.username;
		bcrypt.hash(req.body.password, null, null, function(err, hash) {
			 if(err)
			 {
				 console.log(err);
			 }
			 new_user.Local.Password = hash;
			 new_user.save(function(err){
			if(err){
				console.log(err);
			}
			 res.redirect('/login');})
		 
		});
	}
})

app.get('/login',function(req,res){

	res.sendFile(__dirname+'/client/login.html');
})

app.post('/login',passport.authenticate('local'),function(req,res){
	res.redirect('profile/'+req.user.Local.Name);
});

app.get('/auth/facebook', passport.authenticate('facebook', { scope : ['email']}));

app.get('/auth/facebook/callback',passport.authenticate('facebook'),function(req,res){
	str = req.user.Facebook.email;
	str = str.slice(0,str.indexOf('@'));
	res.redirect('profile/'+str);
});

app.get('/auth/facebook/profile/:name',isLoggedIn,function(req,res){
	res.sendFile(__dirname+'/client/profile.html');
});

app.get('/user',function(req,res){
	User.find(function(err,result){
		if(err){
			console.log(err); //try using promise
		}
		res.send(result);
	})
});

app.get('/session',function(req,res){
res.send(req.session); 
});


app.get('/remove',function(req,res){
	User.find().remove(function(err){
	if(err)
	{console.log(err);}
    res.send('request acknowledge');
});
});

app.get('/logout',function(req,res){
	req.logout();
	req.session.destroy(function(err){
		console.log(err);
	})
	res.redirect('/')
});

app.post('/search',function(req,res){
	var a;
	city_id = CityId(req.body.location_id)
	city_id.then(function(city_id){
	var Entity_id = city_id.location_suggestions[0].entity_id,
	q = req.body.restaurants,
	lat = city_id.location_suggestions[0].latitude,
	lon = city_id.location_suggestions[0].longitude;
    request({
	 headers:{
     'user-key': '657693eec358398b6e7fa690b531f7a7'},
	uri:'https://developers.zomato.com/api/v2.1/search?entity_id='+Entity_id+'&entity_type=city&q='+q+'&lat='+lat+'&lon='+lon,
	method: 'GET'},
	function(error,response,body){
		if(!error && res.statusCode ==200){
			a = JSON.parse(body);
			console.log(a.restaurants[0].restaurant.featured_image);
			res.render('search_result.ejs',{result:a.restaurants});
		}
	})
	})
	.catch((err) => {
		console.log(err)
	})
	
});

//server listening
app.listen(3000,function(){
	console.log('Server is running at port:3000');
});

//function

function isLoggedIn(req, res, next) {

    if (req.isAuthenticated())
	{
		return next();
	}
        
else{ 
res.send('please login');}
   
}


function CityId(state){
	return new Promise((resolve, reject) => {
		var a;
	request({
	 headers:{
     'user-key': '657693eec358398b6e7fa690b531f7a7'},
	uri:'https://developers.zomato.com/api/v2.1/locations?query='+state,
	method: 'GET'},
	function(error,res,body){
		if(!error && res.statusCode ==200){
			 a = JSON.parse(body);
			 resolve(a);
		}
		else{
			reject(a);
		}
	});
	})
}
