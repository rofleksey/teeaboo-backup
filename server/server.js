const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 1997;

app.use(express.static(`${__dirname}/../dist`));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));

app.post('/api', async (req, res) => {
  if (!req.body) {
    res.status(403).end();
    return;
  }
  try {
    if (req.body.type === 'init') {
      console.log('init');
    }
  } catch (e) {
    console.error(e);
    res.status(500).end();
  }
});

app.listen(port);
console.log(`server running on port ${port}!`);
