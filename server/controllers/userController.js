
const { Client } = require('pg')
const {
  RDSClient,
  DescribeDBInstancesCommand,
} = require("@aws-sdk/client-rds");
const {
  SecretsManagerClient,
  ListSecretsCommand,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

// authentication DB with secret manager
const region = process.env.AWS_REGION
var client = () => { }
const run = async () => {
  const rdsClient = new RDSClient({ region: region });
  const smClient = new SecretsManagerClient({ region: region });
  let connection = {
    endpoint: '',
    port: '',
    username: '',
    password: ''
  };
  // get port & endpoint 
  try {
    const describeDBInstancesCommand = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: "rdspg-fcj-labs",
    });
    const describeDBInstancesResponse = await rdsClient.send(
      describeDBInstancesCommand
    );

    connection.endpoint = describeDBInstancesResponse.DBInstances[0].Endpoint.Address;
    connection.port = describeDBInstancesResponse.DBInstances[0].Endpoint.Port;
  } catch (err) {
    console.error(err);
  }
  let secretArn;
  try {
    const listSecretsCommand = new ListSecretsCommand({
      Filters: [{ Key: "name", Values: ["secretPostgresqlMasterUser1"] }],
    });
    const listSecretsResponse = await smClient.send(listSecretsCommand);
    secretArn = listSecretsResponse.SecretList[0].ARN;
  } catch (err) {
    console.error(err);
  }
  //get username & password
  try {
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: secretArn,
    });
    const getSecretValueResponse = await smClient.send(getSecretValueCommand);
    const secretString = JSON.parse(getSecretValueResponse.SecretString);
    connection.username = secretString.username;
    connection.password = secretString.password;

  } catch (err) {
    console.error(err);
  }
  console.log("credential rds postgresql on AWS secret manager", connection)
  client = new Client({
    user: connection.username,
    password: connection.password,
    host: connection.endpoint,
    database: "pglab",
    port: connection.port,
    ssl: {
      rejectUnauthorized: false,
    }
  });
  client.connect((err) => {
    if (err) {
      console.error("connection error", err.stack);
    } else {
      console.log('connected')
    }
  });
};
run();

// View Users
exports.view = async (req, res) => {
  // User the connection
  const qr = await client.query('SELECT * FROM fcj_user ORDER BY id ASC')
  const kq = qr.rows;

  let removedUser = req.query.removed;
  res.render('home', { kq, removedUser });
}


// Find User by Search
exports.find = async (req, res) => {
  const searchTerm = req.body.search;
  const qr = await client.query('SELECT * FROM fcj_user WHERE first_name LIKE $1 OR last_name LIKE $2 ', ['%' + searchTerm + '%', '%' + searchTerm + '%']);
  const kq = qr.rows;
  let removedUser = req.query.removed;
  res.render('home', { kq, removedUser });
}

exports.form = (req, res) => {
  res.render('add-user');
}

// Add new user
exports.create = async (req, res) => {
  const { first_name, last_name, email, phone, courses } = req.body
  const exist_mail = `SELECT COUNT(*) FROM fcj_user WHERE email = $1`;
  console.log(exist_mail);
  const results = await client.query(exist_mail, [email]);
  console.log(results);
  const regex = /^([a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,})$/;
  if (results.rows[0].count > 0 || !regex.test(email)) {
    res.render('add-user', { alert: 'Email invalid or email exist.' });
  }
  else {
    await client.query('INSERT INTO fcj_user (first_name, last_name, email, phone, courses) VALUES ($1, $2, $3, $4, $5)', [first_name, last_name, email, phone, courses], (err, resp) => {
      if (err) {
        console.log(err.stack)
      } else {
        kq = resp.rows[0]
        res.render('add-user', { kq })
      }
    }
    )
  }
}

// Edit user
exports.edit = async (req, res) => {
  // User the connection
  const userid = parseInt(req.params.id)
  await client.query('SELECT * from fcj_user where id= $1', [userid], (err, resp) => {
    if (err) {
      console.log(err.stack)
    } else {
      kq = resp.rows[0]
      res.render('edit-user', { kq })
    }
  }
  )
}


// Update User
exports.update = async (req, res) => {
  const { first_name, last_name, email, phone, courses } = req.body
  const userid = req.params.id
  // User the connection
  await client.query('UPDATE fcj_user SET first_name = $1, last_name= $2, email= $3, phone= $4,courses= $5 WHERE id = $6', [first_name, last_name, email, phone, courses, userid], (err, resp) => {
    if (err) {
      console.log(err.stack)
    } else {
      client.query('SELECT * from fcj_user where id= $1', [userid], (error, resp1) => {
        if (error) {
          console.log(error.stack)
        } else {
          kq = resp1.rows[0]
          console.log(kq)
          res.render('edit-user', { kq, alert: `${first_name} has been updated.` })
        }
      })
    }
  })
}

// Delete User
exports.delete = (req, res) => {

  // Delete a record
  // User the connection

  const userid = parseInt(req.params.id);
  console.log('delete_id:', userid)
  client.query('DELETE FROM fcj_user WHERE id = $1', [userid], (err, resp) => {
    if (err) {
      console.log(err.stack)
    } else {
      client.query('SELECT * from fcj_user order by id desc', (error, resp1) => {
        if (error) {
          console.log(error.stack)
        } else {
          kq = resp1.rows
          res.render('home', { kq, alert: `${userid} has been delete.` })
        }
      })
    }
  })


}

// View Users
exports.viewall = (req, res) => {
  const userid = req.params.id
  // User the connection
  client.query('SELECT * from fcj_user where id= $1', [userid], (err, resp) => {
    if (err) {
      console.log(err.stack)
    } else {
      kq = resp.rows
      res.render('view-user', { kq })
    }
  })
}