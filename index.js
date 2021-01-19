const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const exec = require('child_process').exec;
const rand = require('random-id');

const app = express();

// enable files upload
app.use(fileUpload({
    createParentPath: true
}));

//add other middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(morgan('dev'));

//start app
const port = process.env.PORT || 3000;

var mysql = require('mysql');
const { readFile } = require('fs');
const { SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS } = require('constants');

var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "videotube"
});

app.listen(port, () =>
  console.log(`App is listening on port ${port}.`)
);

app.get('/upload', (req, res) => {

  readFile('./html/upload.html', 'utf8', (err, html) => {

    if(err) {
      res.status(500).send('Page not available')
    }

    res.send(html);

  })

});

app.post('/upload', async (req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No video uploaded'
            });
        } else {
            //Use the name of the input field (i.e. "video") to retrieve the uploaded file
            let video = req.files.video;

            var name = req.body.name;
            var description = req.body.description;
            var privacy = req.body.privacy;
            var tags = req.body.tags;
            var category = req.body.category; 

            if(category > 15) {
              res.status(500).send("Invalid category ID");
            } else if (category < 1) {
              res.status(500).send("Invalid category ID");
            } else {
              // do absolutely nothing
            }

            //Use the mv() method to place the file in upload directory (i.e. "uploads")
            video.mv('./tmp/' + video.name);

            var id = rand(12, 'aA0');
            var ffmpeg = require("fluent-ffmpeg");
            var inFilename = './tmp/' + video.name;
            var outFilename = './uploads/' + id + '.mp4';

            var videoId = rand(12, 'aA0');
            

            console.log(outFilename);

            var convertToMp4 = async () => {
              ffmpeg(inFilename)
                .outputOptions("-c:v", "copy")
                .save(outFilename);
              }

                var insertVideoInfo = async () => {
                  con.connect(function(err) {
                    console.log("Video Upload database: Connected!");
                    
                    var sql = "INSERT INTO videos (title, uploadedBy, description, tags, privacy, category, filePath, url) VALUES ('" + name + "', 'node.js', '" + description + "', '" + tags + "', '" + privacy + "', '1', '" + outFilename + "', '" + videoId + "')";
                    con.query(sql, function (err, result) {
                      console.log("Video Uploaded");
                      // console.dir(result);

                      var latestID = result.insertId;
                      return latestID; 
                    });
                  });
                }

              var latestVideoId = insertVideoInfo();

              var proccessThumbnails = async () => {

                var thumbnailId = rand(20, 'aA0');

                await ffmpeg(outFilename)
                .screenshot({
                  count: 3,
                  folder: 'thumbnails',
                  size: '1280x720',
                  filename: thumbnailId + '-' + id + '.png'
                })

                con.connect(function(err) {
                  console.log("Thumbnail Upload Database: Connected");
                  
                  var sql = "INSERT INTO thumbnails (videoId, filePath, selected) VALUES ?";
                  let params = [
                    [latestVideoId, './thumbnails/' + thumbnailId + '-' + id + '_1.png', '1'], 
                    [latestVideoId, './thumbnails/' + thumbnailId + '-' + id + '_2.png', '0'], 
                    [latestVideoId, './thumbnails/' + thumbnailId + '-' + id + '_3.png', '0']
                  ];
                  con.query(sql, [params], function (err, result) {
                    console.log("Thumbnail Video inserted");
                    // console.dir(result)
                    console.dir(params);
                  });
                });

              }

            var calculateVideoDuration = async () => {
              await ffmpeg.ffprobe(outFilename, function(err, metadata) {
                // console.log(metadata.streams[0].duration);
                var videoDuration = metadata.streams[0].duration;
              })
            }

            setTimeout(convertToMp4, 500);
            setTimeout(insertVideoInfo, 1000);
            setTimeout(proccessThumbnails, 2000);
            setTimeout(calculateVideoDuration, 3000);

            //send response
            res.send({
                status: true,
                message: 'Video is uploaded',
                data: {
                    name: video.name,
                    mimetype: video.mimetype,
                    size: video.size
                }
            });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});
