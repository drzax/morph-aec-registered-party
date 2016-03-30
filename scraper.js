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

  var $cells = $('#contentstart .col-md-8 table td');

  data.$name =                    $cells.eq(0).text();
  data.$abbreviation =            $cells.eq(1).text();
  data.$parliamentary =           $cells.eq(2).text().trim() === 'Yes';
  data.$officer_name =            $cells.eq(3).text();
  data.$officer_address =         $cells.eq(4).text();
  data.$notes =                   $cells.eq(5).text();
  data.$correspondence_address =  $cells.eq(6).text();
  data.$deputy_officers =         $cells.eq(7).text();
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