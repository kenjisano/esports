var Sequelize = require('sequelize');
var sequelize = new Sequelize(null, null, null, {
  dialect: 'sqlite',
  storage: 'db.sqlite'
});
var express = require('express');
var app = express();
var request = require('request');
var colors = require('colors/safe');

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

var cache = {};
cache.live = [];
cache.recent = [];
cache.upcoming = [];
var _429_count = 0;

app.get('/', function (req, res) {
	res.send("OK");
});

app.get('/live', function (req, res) {
	res.setHeader("cache-control", "private, max-age=0");
	res.send(cache);
});

app.get('/rankings', function (req, res) {
	request('https://www.kimonolabs.com/api/7l4jhyqm?apikey=rmfhJUI9Z9lu0kCpBq8OxyFsWdojzeW5', function (error, response, body) {
		if (!error && response.statusCode == 200) {
	        var json = JSON.parse(body.toString());
			res.setHeader("cache-control", "private, max-age=0");
	        res.send(json.results.Rankings);
	    }
	});
});

app.get('/lolrankings', function (req, res) {
	request('https://www.kimonolabs.com/api/21rwmuec?apikey=rmfhJUI9Z9lu0kCpBq8OxyFsWdojzeW5', function (error, response, body) {
		if (!error && response.statusCode == 200) {
	        var json = JSON.parse(body.toString());
	        res.send(json.results.Rankings);	
	    }
	});
});

app.get('/csgorankings', function (req, res) {
	request('https://www.kimonolabs.com/api/77l6pi1k?apikey=rmfhJUI9Z9lu0kCpBq8OxyFsWdojzeW5', function (error, response, body) {
		if (!error && response.statusCode == 200) {
	        var json = JSON.parse(body.toString());
	        res.send(json.results.Rankings);
	    }
	});
});

function get_matches() {
	if (_429_count > 10) {
		_429_count = 0;
		setTimeout(function(){get_matches();}, 20*1000);
		return;
	}
	console.log("Getting matches...");
	request('https://www.kimonolabs.com/api/bwsjvxzq?apikey=rmfhJUI9Z9lu0kCpBq8OxyFsWdojzeW5', function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	        var json = JSON.parse(body.toString());
	        

	        var liveNum = json.results.Live.length;
	        var liveDone = 0;
			json.results.Live.forEach(function(e,i,a){
				console.log("L> " + e["Live Left"].text + " vs " + e["Live Right"].text);
				var item = {};
				item.left = e["Live Left"].text;
				item.leftOdds = e["Live Left Odds"].text.replace(/[()]/g, '');
				item.right = e["Live Right"].text;
				item.rightOdds = e["Live Right Odds"].text.replace(/[()]/g, '');
				item.link = e["Live Link"];
				var inCache = get_cached_value(item, cache.live);
				if (inCache) {
					item = inCache;
					if (item.match) {
						console.log("  L> " + e["Live Left"].text + " vs " + e["Live Right"].text + " info already in cache");
						++liveDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					}
				}
				else {
					console.log("   L> Adding " + e["Live Left"].text + " vs " + e["Live Right"].text + " to cache");
					cache.live.push(item);
				}
				if (!item.match) {
					console.log("  L> Getting match info for " + e["Live Left"].text + " vs " + e["Live Right"].text);
					var split = item.link.split("//")[1].split("/");
					request('https://www.kimonolabs.com/api/ondemand/dsdeq41g?apikey=rmfhJUI9Z9lu0kCpBq8OxyFsWdojzeW5'
						+ '&kimpath3=' + split[3] + "&kimpath4=" + split[4] + '&kimpath5=' + split[5] + "&kimpath7=" + split[7],
						function (error, response, body) {
					    if (!error && response.statusCode == 200) {
					        var json = JSON.parse(body.toString());
					        
					        var match = {};
					        match.title = json.results.Data[0].Title.text;
					        match.subtitle = json.results.Data[0].Subtitle;
					        match.left = {};
					        match.left.name = json.results.Data[0]["Left Team"].text.replace("...", "").replace(/[G|g]ami?n?g?/g, "").replace(/[T|t]eam/g, "");
					        match.left.rank = json.results.Data[0]["Left Rank"];
					        match.left.odds = json.results.Data[0]["Left Odds"];
					        match.left.team = json.results.Data[0]["Left Faction"];
					        match.left.players = [];
					        json.results["Left Players"].forEach(function(e,i,a){
					        	var pl = {};
					        	pl.name = e["Left Players"];
					        	pl.hero = e["Left Heroes"];
					        	match.left.players.push(pl);
					        });
					        match.right = {};
					        match.right.name = json.results.Data[0]["Right Team"].text.replace("...", "").replace(/[G|g]ami?n?g?/g, "").replace(/[T|t]eam/g, "");
					        match.right.rank = json.results.Data[0]["Right Rank"];
					        match.right.odds = json.results.Data[0]["Right Odds"];
					        match.right.team = json.results.Data[0]["Right Faction"];
					        match.right.players = [];
					        json.results["Right Players"].forEach(function(e,i,a){
					        	var pl = {};
					        	pl.name = e["Right Players"];
					        	pl.hero = e["Right Heroes"];
					        	match.right.players.push(pl);
					        });
					        match.drawOdds = json.results.Data[0]["Draw Odds"];
					        match.numGames = json.results.Data[0]["Number of Games"];
					        match.pastMatches = [];
					        json.results["Past Encounters"].forEach(function(e,i,a){
					        	var past = {};
					        	past.left = e["Left Past Encounters"].text;
					        	past.right = e["Right Past Encounters"].text;
					        	match.pastMatches.push(past);
					        });
					        item.match = match;
					        console.log(colors.green("  L> Got info for " + e["Live Left"].text + " vs " + e["Live Right"].text));
					        ++liveDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);

					    }
					    else if (error) {
					        console.log(colors.red("  L> Error (" + e["Live Left"].text + " vs " + e["Live Right"].text + "): " + error));
					        ++liveDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					    }
					    else {
					        console.log(colors.yellow("  L> Status not 200 (" + e["Live Left"].text + " vs " + e["Live Right"].text + "): " + response.statusCode));
					        if (response.statusCode == 429) ++_429_count;
					        ++liveDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					    }
					});
				}
			});


	        var upcomingNum = json.results.Upcoming.length;
	        var upcomingDone = 0;
			json.results.Upcoming.forEach(function(e,i,a) {
				console.log("U> " + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text);
				var item = {};
				item.left = e["Upcoming Left"].text;
				item.leftOdds = e["Upcoming Left Odds"].text.replace(/[()]/g, '');
				item.right = e["Upcoming Right"].text;
				item.rightOdds = e["Upcoming Right Odds"].text.replace(/[()]/g, '');
				item.link = e["Upcoming Link"];
				var inCache = get_cached_value(item, cache.upcoming);
				if (inCache) {
					item = inCache;
					if (item.match) {
						console.log("  U> " + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text + " info already in cache");
						++upcomingDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					}
				}
				else {
					console.log("  U> Adding " + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text + " to cache");
					cache.upcoming.push(item);
				}
				if (!item.match) {
					 console.log("  U> Getting match info for " + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text);
					 var split = item.link.split("//")[1].split("/");
					 request('https://www.kimonolabs.com/api/ondemand/btdkt6lq?apikey=rmfhJUI9Z9lu0kCpBq8OxyFsWdojzeW5'
					 	+ '&kimpath3=' + split[3] + "&kimpath4=" + split[4] + '&kimpath5=' + split[5] + "&kimpath7=" + split[7],
					 	function (error, response, body) {
					      if (!error && response.statusCode == 200) {
					        var json = JSON.parse(body.toString());
					        if (!json.results.Data) {
					        	console.log(colors.red("  U> Error (" + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text + "): no Data field"));
					        	++upcomingDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					        }
					        else {
						        var match = {};
						        match.title = json.results.Data[0].Title.text;
						        match.subtitle = json.results.Data[0].Subtitle;
						        match.date = json.results.Data[0].Date;
						        match.countdown = json.results.Data[0].Countdown;
						        match.left = {};
						        match.left.name = json.results.Data[0]["Left Team"].text.replace("...", "").replace(/[G|g]ami?n?g?/g, "").replace(/[T|t]eam/g, "");
						        match.left.rank = json.results.Data[0]["Left Rank"];
						        match.left.odds = json.results.Data[0]["Left Odds"];
						        match.left.team = json.results.Data[0]["Left Faction"];
						        match.right = {};
						        match.right.name = json.results.Data[0]["Right Team"].text.replace("...", "").replace(/[G|g]ami?n?g?/g, "").replace(/[T|t]eam/g, "");
						        match.right.rank = json.results.Data[0]["Right Rank"];
						        match.right.odds = json.results.Data[0]["Right Odds"];
						        match.right.team = json.results.Data[0]["Right Faction"];
						        match.numGames = json.results.Data[0]["Number of Games"];
						        match.pastMatches = [];
						        if (json.results["Past Encounters"]) {
							        json.results["Past Encounters"].forEach(function(e,i,a){
								       	var past = {};
							          	past.left = e["Left Past Encounters"].text;
							         	past.right = e["Right Past Encounters"].text;
							         	match.pastMatches.push(past);
							        });
							    }
						        item.match = match;
						        console.log(colors.green("  U> Got info for " + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text));
						        ++upcomingDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
						    }
					    }
					    else if (error) {
					        console.log(colors.red("  U> Error (" + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text + "): " + error));
					        ++upcomingDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					    }
					    else {
					        console.log(colors.yellow("  U> Status not 200 (" + e["Upcoming Left"].text + " vs " + e["Upcoming Right"].text + "): " + response.statusCode));
					        if (response.statusCode == 429) ++_429_count;
					        ++upcomingDone; if (liveDone >= liveNum && upcomingDone >= upcomingNum) setTimeout(function(){get_matches();}, 5*1000);
					    }
					});
				}
			});
	    }
	});
}

function get_cached_value(item, c) {
	var result;
	c.forEach(function(e,i,a){
		if (e.link == item.link) {
				result = e;
		}
	});
	return result;
}

var server = app.listen(3000, host="0.0.0.0", debug=true, function () {
  console.log('Example app listening at http://%s:%s',
  	server.address().address, server.address().port);
  get_matches();
});
