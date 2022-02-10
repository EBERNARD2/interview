//CLI dependencies
const fs = require("fs");
const path = require("path");

//write to ouput file dependency

const createCsvWriter = require('csv-writer').createObjectCsvWriter;
//Third party APIs 1:reverse lookup location based on coordinates
const reverseGeoCode = require('reverse-geocode');
const DeviceDetector = require("device-detector-js");
const deviceDetector = new DeviceDetector();

//synchronously access Geolite2 db
const geolite2 = require('geolite2');
const Reader = require('@maxmind/geoip2-node').Reader;

//Process CLI arguments when file runs 
const totalLogs = process.argv[2] ? process.argv[2] : './log.log';

//read file and split at each new line to seperate logs
const testFile = fs.readFileSync(path.resolve(__dirname, totalLogs), "utf8");
 
//iterate through log files 
const individualLogs = testFile.split("\n");

//core function to CLI tool... fetching all data from third party APIs
const fetchCsvData = async(totalLogs) => {
  const records = [];
  //loop through logs 
  for (let log of totalLogs) {
   let country, state; 

   //synchronously retrivie country data from geo2lite
   const dbBuffer = fs.readFileSync(geolite2.paths.city);
   const ipAddress = log.split("- -")[0];
  
   const reader = Reader.openBuffer(dbBuffer);
   const response = reader.city(ipAddress.substring(0, ipAddress.length - 1));

   //since Geo2lite does not provide state data we must 
   //use coordinates to fetch state from reverse geocode api 
   const longitude = response.location.longitude;
   const latitude = response.location.latitude;

   country = response.country.names.en;
   const countryCode = response.country.isoCode

   const stateLookup = await reverseGeoCode.lookup(latitude, longitude, countryCode);

   //if state is not found in lookup we'll just set entry to N?A
   if (stateLookup) state = stateLookup.state;
   else state = "N/A";

   //Third party call to find user agent 
   const splitUserAgent = log.split("Mozilla/5.0 ");
   const userAgent = `Mozilla/5.0 ${splitUserAgent[1]}`;

   const device = await deviceDetector.parse(userAgent);

   let type, name; 
   if (device.client) {
     type = device.client.type;
     name = device.client.name;
   } else {
     type = "Not Found";
     name = "Not Found";
   }

   records.push({
      ip : ipAddress,
      country : country,
      state : state,
      type : type,
      name : name,
  });
  
 }
 return records;
}

//compile file colomuns and write to output CSV
const compileFile = async() => {
  
  //records
  const records = await fetchCsvData(individualLogs);
  
  //CSV write setup w/ column names 
  const csvWriter = createCsvWriter({
    path: 'output.csv',
    header: [
      {id: 'ip', title: 'IP Address'},
      {id: 'country', title: 'Country'},
      {id: 'state', title: 'State'},
      {id: 'userAgent', title: 'UserAgent'},
      {id: 'type', title: 'Type'},
      {id: 'name', title: 'Name'}
    ]
  });

  //write to output file
  csvWriter.writeRecords(records).then(() => {
   console.log('...Done writing to ouput file');
 }).catch(err => {
  console.log(`Error writing to output file ${err}`);
});
};

//start file compilation process
compileFile();