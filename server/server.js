const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const port = 1997;

app.use(express.static(`${__dirname}/ui/dist`));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));
app.listen(port);
console.log(`server running on port ${port}!`);
