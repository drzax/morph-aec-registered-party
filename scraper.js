#! /usr/bin/env node

var cheerio = require('cheerio');
var request = require('request');
var queue = require('d3-queue').queue(10);
var sqlite = require('sqlite3');

const domain = 'http://www.aec.gov.au';
const listing = domain + "/Parties_and_Representatives/party_registration/Registered_parties/";

// Set up sqlite database.
var db = new sqlite.Database("data.sqlite");

db.serialize(function() {
  db.run("CREATE TABLE IF NOT EXISTS data (name TEXT PRIMARY KEY, abbreviation TEXT, parliamentary BOOLEAN, officer_name TEXT, officer_address TEXT, notes TEXT, correspondence_address TEXT, deputy_officers TEXT, registered_date TEXT, url TEXT)");
  start(db);
});

function start(db) {
  request(listing, function(error,response,body){
    var $ = cheerio.load(body);

    $('#party-list li a').each(function(){
      var href = $(this).attr('href');
      var url = (href.charAt(0) === '/') ? domain + href : listing + href;
      queue.defer(requestDetail({db:db,url:url}));
    });
  });
}

function requestDetail(opts) {
  return function(cb){
    opts.cb = cb;
    request(opts.url, handleDetail.bind(opts));
  };
}

function handleDetail(err, res, body) {

  var data = {}, opts = this;

  if (err) {
    return console.error(err);
  }

  var $ = cheerio.load(body);

  console.log('Scrape: '+opts.url);

  var $cells = $('#contentstart .col-md-8 table').find('th, td');

  var pr = $('#contentstart .col-md-8 table th').eq(2).text().replace(/\:/g,'').toLowerCase() === 'Parliamentary Party'.toLowerCase();

  data.$name =                    $cells.eq(1).text();
  data.$abbreviation =            $cells.eq(3).text();
  data.$parliamentary =           (pr) ? $cells.eq(5).text().trim() === 'Yes' : false;
  data.$officer_name =            $cells.eq((pr)?8:6).text();
  data.$officer_address =         $cells.eq((pr)?10:8).text();
  data.$notes =                   $cells.eq((pr)?11:9).text();
  data.$correspondence_address =  $cells.eq((pr)?13:11).text();
  data.$deputy_officers =         $cells.eq((pr)?15:13).text();
  data.$registered_date =         $cells = $('#contentstart .col-md-8 table').prev('p').text().match(/registered on ([0-9]{1,2} [^\s]* [0-9]{4})/)[1];
  data.$url =                     opts.url;

  // Save to DB
  updateRow(opts.db, data);

  // Callback
  opts.cb();
}

function updateRow(db, values) {
	// Insert some data.
	var statement = db.prepare("INSERT OR REPLACE INTO data VALUES ($name, $abbreviation, $parliamentary, $officer_name, $officer_address, $notes, $correspondence_address, $deputy_officers, $registered_date, $url)");
	statement.run(values);
	statement.finalize();
}