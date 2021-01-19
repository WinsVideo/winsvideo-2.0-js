const express = require('express');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const exec = require('child_process').exec;
const rand = require('random-id');
const fs = require('fs');

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

var validator = require('validator');

//start app
const port = process.env.PORT || 3000;

const { readFile } = require('fs');
const { SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS } = require('constants');

var mysql = require('mysql');
const { lastIndexOf, get } = require('lodash');
var con = mysql.createConnection({
  
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

              ffmpeg(inFilename)
                .on('error', function(err) {
                  // handle error conditions
                  if (err) {
                    console.log('Error transcoding file');
                  }
                })
              }

              

                var insertVideoInfo = async () => {
                  con.connect(function(err) {
                    console.log("Video Upload database: Connected!");
                    
                    var sql = "INSERT INTO videos (title, uploadedBy, description, tags, privacy, category, filePath, url) VALUES ('" + name + "', 'node.js', '" + description + "', '" + tags + "', '" + privacy + "', '1', '" + outFilename + "', '" + videoId + "')";
                    con.query(sql, function (err, result) {
                      console.log("Video Info inserted");
                    
                      console.dir(result);
                  var proccessThumbnails = async () => {
                
                    var thumbnailId = rand(20, 'aA0');
                    var latestVideoId = result.insertId;
    
                    await ffmpeg(outFilename)
                    .screenshot({
                      count: 3,
                      folder: 'thumbnails',
                      size: '1280x720',
                      filename: thumbnailId + '-' + id + '.png'
                    })
    
                    con.connect(function(err) {
                      console.log("Thumbnail Upload Database: Connected");
                      var thumbnailVideoId = rand(12, 'aA0');
                      var sql = "INSERT INTO thumbnails (videoId, filePath, selected, url) VALUES ?";
                      let params = [
                        [latestVideoId, './thumbnails/' + thumbnailId + '-' + id + '_1.png', '1', thumbnailVideoId], 
                        [latestVideoId, './thumbnails/' + thumbnailId + '-' + id + '_2.png', '0', thumbnailVideoId], 
                        [latestVideoId, './thumbnails/' + thumbnailId + '-' + id + '_3.png', '0', thumbnailVideoId]
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
      
                  var deleteInputVideo = async () => {
                    await fs.unlink(inFilename, (err) => {
                        if (err) {
                            throw err;
                        }
                    
                        console.log("Video: " + inFilename + "is now deleted from the tmp folder");
                    });
                  }

                  setTimeout(proccessThumbnails, 2000);
                setTimeout(calculateVideoDuration, 3000);
                setTimeout(deleteInputVideo, 4000);
              });
            });

                }
            setTimeout(convertToMp4, 500);
            setTimeout(insertVideoInfo, 1000);
            
            
            //send response
            res.send({
              status: true,
              message: 'Video is uploaded',
              data: {
                  name: video.name,
                  mimetype: video.mimetype,
                  size: video.size,
                  outputVideo: outFilename,
                  inputVideo: inFilename,
                  viewVideo: "https://winsvideo.net/watch?url="+videoId+""
              }
          });

        }
    } catch (err) {
        res.status(500).send(err);
    }
});








function getUserSubscriberCount(username) {
  con.connect(function(err) {  
    var sql = "SELECT * FROM subscribers WHERE userTo=:userTo";
    con.query(sql, function (err, result) {
      // console.dir(result);

      var latestID = result.insertId;
      return latestID; 
    });
  });
}

app.get('/api/subscribers/users/:id',(req, res) => {
  let sql = "SELECT * FROM subscribers WHERE userTo='" +req.params.id+ "'";
  let query = con.query(sql, (err, results) => {
    if(err) throw err;
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({"username": req.params.id, "subscribers": results.length}));
  });
});

//show all users
app.get('/api/users',(req, res) => {
  let sql = "SELECT username,signUpDate,keywords,about,country FROM users";
  let query = con.query(sql, (err, results) => {
    if(err) throw err;
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
  });
});
 
//show single user
app.get('/api/users/:id',(req, res) => {
  let sql = "SELECT username,signUpDate,keywords,about,country FROM users WHERE username = '"+req.params.id+"'";
  let query = con.query(sql, (err, results) => {
    if(err) throw err;
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
  });
});

//show all videos
app.get('/api/video',(req, res) => {
  let sql = "SELECT uploadedBy,title,description,category,uploadDate,views,duration,url,tags FROM videos";
  let query = con.query(sql, (err, results) => {
    if(err) throw err;
    // videoArray = validator.escape(results);
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
    // videoArray = validator.escape(results);
  });
});
 
//show single video
app.get('/api/video/:id',(req, res) => {
  let sql = "SELECT uploadedBy,title,description,category,uploadDate,views,duration,url,tags FROM videos WHERE url = '"+req.params.id+"'";
  let query = con.query(sql, (err, results) => {
    if(err) throw err;
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
  });
});
 

//update video
app.put('/api/update/video/:url',(req, res) => {
  let sql = "UPDATE videos SET title='"+req.body.title+"', description='"+req.body.description+"', privacy='"+req.body.privacy+"', category='"+req.body.category+"', tags='"+req.body.tags+"' WHERE url="+req.params.url;
  let query = conn.query(sql, (err, results) => {
    if(err) throw err;
    res.setHeader("Content-Type", "application/json");
    res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
  });
});
 
//Delete video
app.delete('/api/delete/video/:url',(req, res) => {
  let sql = "DELETE FROM videos WHERE url="+req.params.url+"";
  let query = conn.query(sql, (err, results) => {
    if(err) throw err;
      res.setHeader("Content-Type", "application/json");
      res.send(JSON.stringify({"status": 200, "error": null, "response": results}));
  });
});
