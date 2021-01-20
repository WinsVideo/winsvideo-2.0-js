const express = require('express')
const fileUpload = require('express-fileupload')
const cors = require('cors')
const bodyParser = require('body-parser')
const morgan = require('morgan')
const _ = require('lodash')
const exec = require('child_process').exec
const rand = require('random-id')
const fs = require('fs')
const config = require('./config.json')

const app = express()

// enable files upload
app.use(fileUpload({
  createParentPath: true
}))

// add other middleware
app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(morgan('dev'))

const validator = require('validator')

// start app
const port = process.env.PORT || 3000

const { readFile } = require('fs')
const { SSL_OP_DONT_INSERT_EMPTY_FRAGMENTS } = require('constants')

const mysql = require('mysql')
const { lastIndexOf, get } = require('lodash')
const con = mysql.createConnection({
  host: config.dbInfo.host,
  user: config.dbInfo.user,
  password: config.dbInfo.password,
  database: config.dbInfo.database
})

app.listen(port, () =>
  console.log(`App is listening on port ${port}.`)
)

app.get('/', (req, res) => {
  readFile('./html/index.html', 'utf8', (err, html) => {
    if (err) {
      res.status(500).send('Page not available')
    }

    res.send(html)
  })
})

app.get('/upload', (req, res) => {
  readFile('./html/upload.html', 'utf8', (err, html) => {
    if (err) {
      res.status(500).send('Page not available')
    }

    res.send(html)
  })
})

app.post('/upload', async (req, res) => {
  try {
    if (!req.files) {
      res.send({
        status: false,
        message: 'No video uploaded'
      })
    } else {
      // Use the name of the input field (i.e. "video") to retrieve the uploaded file
      const video = req.files.video

      const name = req.body.name
      const description = req.body.description
      const privacy = req.body.privacy
      const tags = req.body.tags
      const category = req.body.category

      if (category > 15) {
        res.status(500).send('Invalid category ID')
      } else if (category < 1) {
        res.status(500).send('Invalid category ID')
      } else {
        // do absolutely nothing
      }

      // Use the mv() method to place the file in upload directory (i.e. "uploads")
      video.mv('./tmp/' + video.name)

      const id = rand(12, 'aA0')
      const ffmpeg = require('fluent-ffmpeg')
      const inFilename = './tmp/' + video.name
      const outFilename = './uploads/videos/' + id + '.mp4'

      const videoId = rand(12, 'aA0')

      console.log(outFilename)

      const convertToMp4 = async () => {
        ffmpeg(inFilename)
          .outputOptions('-c:v', 'copy')
          .save(outFilename)

        ffmpeg(inFilename)
          .on('error', function (err) {
            // handle error conditions
            if (err) {
              console.log('Error transcoding file')
            }
          })
      }

      const insertVideoInfo = async () => {
        con.connect(function (err) {
          console.log('Video Upload database: Connected!')

          const sql = "INSERT INTO videos (title, uploadedBy, description, tags, privacy, category, filePath, url) VALUES ('" + name + "', 'node-admin', '" + description + "', '" + tags + "', '" + privacy + "', '1', 'uploads/videos/" + id + ".mp4', '" + videoId + "')"
          con.query(sql, function (err, result) {
            console.log('Video Info inserted')

            console.dir(result)
            const proccessThumbnails = async () => {
              const thumbnailId = rand(20, 'aA0')
              const latestVideoId = result.insertId

              await ffmpeg(outFilename)
                .screenshot({
                  count: 3,
                  folder: 'uploads/videos/thumbnails',
                  size: '1280x720',
                  filename: thumbnailId + '-' + id + '.png'
                })

              con.connect(function (err) {
                console.log('Thumbnail Upload Database: Connected')
                const thumbnailVideoId = rand(12, 'aA0')
                const sql = 'INSERT INTO thumbnails (videoId, filePath, selected, url) VALUES ?'
                const params = [
                  [latestVideoId, 'uploads/videos/thumbnails/' + thumbnailId + '-' + id + '_1.png', '1', thumbnailVideoId],
                  [latestVideoId, 'uploads/videos/thumbnails/' + thumbnailId + '-' + id + '_2.png', '0', thumbnailVideoId],
                  [latestVideoId, 'uploads/videos/thumbnails/' + thumbnailId + '-' + id + '_3.png', '0', thumbnailVideoId]
                ]
                con.query(sql, [params], function (err, result) {
                  console.log('Thumbnail Video inserted')
                  // console.dir(result)
                  console.dir(params)
                })
              })
            }

            const calculateVideoDuration = async () => {
              await ffmpeg.ffprobe(outFilename, function (err, metadata) {
                const latestVideoId = result.insertId
                const videoDuration = metadata.streams[0].duration
                const sql = 'UPDATE videos SET duration=' + videoDuration + ' WHERE id=' + latestVideoId + ''
                con.query(sql, function (err, result) {
                  console.log('Updated the video duration')
                  // console.dir(result)
                })
              })
            }

            const deleteInputVideo = async () => {
              await fs.unlink(inFilename, (err) => {
                if (err) {
                  throw err
                }

                console.log('Video: ' + inFilename + ' is now deleted from the tmp folder')

                // send response
                res.send({
                  status: true,
                  message: 'Video is uploaded',
                  data: {
                    name: video.name,
                    mimetype: video.mimetype,
                    size: video.size,
                    outputVideo: outFilename,
                    inputVideo: inFilename,
                    viewVideo: 'https://winsvideo.net/watch?v=' + videoId + ''
                  }
                })
              })
            }

            setTimeout(proccessThumbnails, 2000)
            setTimeout(calculateVideoDuration, 3000)
            setTimeout(deleteInputVideo, 4000)
          })
        })
      }
      setTimeout(convertToMp4, 500)
      setTimeout(insertVideoInfo, 1000)
    }
  } catch (err) {
    res.status(500).send(err)
  }
})

function getUserSubscriberCount (username) {
  con.connect(function (err) {
    const sql = 'SELECT * FROM subscribers WHERE userTo=:userTo'
    con.query(sql, function (err, result) {
      // console.dir(result);

      const latestID = result.insertId
      return latestID
    })
  })
}

app.get('/api/subscribers/users/:id', (req, res) => {
  const sql = "SELECT * FROM subscribers WHERE userTo='" + req.params.id + "'"
  const query = con.query(sql, (err, results) => {
    if (err) throw err
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ username: req.params.id, subscribers: results.length }))
  })
})

// show all users
app.get('/api/users', (req, res) => {
  const sql = 'SELECT username,signUpDate,keywords,about,country FROM users'
  const query = con.query(sql, (err, results) => {
    if (err) throw err
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ status: 200, error: null, response: results }))
  })
})

// show single user
app.get('/api/users/:id', (req, res) => {
  const sql = "SELECT username,signUpDate,keywords,about,country FROM users WHERE username = '" + req.params.id + "'"
  const query = con.query(sql, (err, results) => {
    if (err) throw err
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ status: 200, error: null, response: results }))
  })
})

// show all videos
app.get('/api/video', (req, res) => {
  const sql = 'SELECT uploadedBy,title,description,category,uploadDate,views,duration,url,tags FROM videos'
  const query = con.query(sql, (err, results) => {
    if (err) throw err
    // videoArray = validator.escape(results);
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ status: 200, error: null, response: results }))
    // videoArray = validator.escape(results);
  })
})

// show single video
app.get('/api/video/:id', (req, res) => {
  const sql = "SELECT uploadedBy,title,description,category,uploadDate,views,duration,url,tags FROM videos WHERE url = '" + req.params.id + "'"
  const query = con.query(sql, (err, results) => {
    if (err) throw err
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ status: 200, error: null, response: results }))
  })
})

// update video
app.put('/api/update/video/:url', (req, res) => {
  const sql = "UPDATE videos SET title='" + req.body.title + "', description='" + req.body.description + "', privacy='" + req.body.privacy + "', category='" + req.body.category + "', tags='" + req.body.tags + "' WHERE url=" + req.params.url
  const query = conn.query(sql, (err, results) => {
    if (err) throw err
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ status: 200, error: null, response: results }))
  })
})

// Delete video
app.delete('/api/delete/video/:url', (req, res) => {
  const sql = 'DELETE FROM videos WHERE url=' + req.params.url + ''
  const query = conn.query(sql, (err, results) => {
    if (err) throw err
    res.setHeader('Content-Type', 'application/json')
    res.send(JSON.stringify({ status: 200, error: null, response: results }))
  })
})
