const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started on 3000 portal..");
    });
  } catch (error) {
    console.log(`Error:${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const cnvtSnakeCaseToCamelCase = (obj) => {
  return {
    stateId: obj.state_id,
    stateName: obj.state_name,
    population: obj.population,
  };
};

const cnvtSnakeCaseToCamelCaseofDistrict = (obj) => {
  return {
    districtId: obj.district_id,
    districtName: obj.district_name,
    stateId: obj.state_id,
    cases: obj.cases,
    cured: obj.cured,
    active: obj.active,
    deaths: obj.deaths,
  };
};

//API authenticateJwtToken
const authenticateJwtToken = (request, response, next) => {
  let jwtToken;
  const authHead = request.headers["authorization"];
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "1234", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API Login User
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const validUserQuery = `SELECT * FROM user WHERE username LIKE '${username}';`;
  const isValidUser = await db.get(validUserQuery);
  if (isValidUser !== undefined) {
    const validPassword = await bcrypt.compare(password, isValidUser.password);
    if (validPassword) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "1234");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//API 2 All state details

app.get("/states/", authenticateJwtToken, async (request, response) => {
  const stateDetailsQuery = `SELECT * FROM state;`;
  const stateQueryResponse = await db.all(stateDetailsQuery);
  response.send(
    stateQueryResponse.map((eachItem) => cnvtSnakeCaseToCamelCase(eachItem))
  );
});

//API 3 State Details
app.get("/states/:stateId", authenticateJwtToken, async (request, response) => {
  const { stateId } = request.params;
  const stateDetailQuery = `SELECT * FROM state WHERE state_id =${stateId};`;
  const stateDetailQueryResponse = await db.get(stateDetailQuery);
  response.send(cnvtSnakeCaseToCamelCase(stateDetailQueryResponse));
});

//API 4 CREATE district
app.post("/districts/", authenticateJwtToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `INSERT INTO district(district_name,state_id,cases,cured,active,deaths) VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

//API 5 Get district details
app.get(
  "/districts/:districtId",
  authenticateJwtToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetailQuery = `SELECT * FROM district WHERE district_id =${districtId};`;
    const districtDetailQueryResponse = await db.get(districtDetailQuery);
    response.send(
      cnvtSnakeCaseToCamelCaseofDistrict(districtDetailQueryResponse)
    );
  }
);

//API 6 Delete district Details
app.delete(
  "/districts/:districtId",
  authenticateJwtToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId};`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API7 Update district Details
app.put(
  "/districts/:districtId",
  authenticateJwtToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateDistrictQuery = `UPDATE district SET district_name = '${districtName}', state_id = ${stateId}, cases = ${cases}, cured = ${cured}, active = ${active}, deaths = ${deaths} WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8
app.get(
  "/states/:stateId/stats/",
  authenticateJwtToken,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `SELECT SUM(cases) AS totalCases, SUM(cured) AS totalCured, SUM(active) AS totalActive, SUM(deaths) AS totalDeaths FROM district WHERE state_id = ${stateId};`;
    const statsResponse = await db.get(statsQuery);
    response.send(statsResponse);
  }
);

module.exports = app;
