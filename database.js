var mongoose = require('mongoose');

mongoose.connect('mongodb://localhost/fastfood_database',function(err){
	if(err)
	{
		console.log(err);
	}
	else{
		console.log('connected to database');
	}
});


var reg_schema = mongoose.Schema({
Local:{
	Name : {type: String},
	Username :{type : String,
	unique : true},
	Email    :{type : String},
	Password :{type : String}	
},
Facebook:{
	id:{type:String},
	token:{type:String},
	name:{type:String},
	email:{type:String}
}})

var User = mongoose.model('User',reg_schema);

exports.User = User;