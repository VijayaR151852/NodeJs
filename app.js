const express = require("express");
const { open } = require("sqlite");
const { format, parse, isValid } = require("date-fns");
const sqlite3 = require("sqlite3");
const path = require("path");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "todoApplication.db");
let database = null;

const initialize = async () => {
  try {
    database = await open({ filename: dbPath, driver: sqlite3.Database });
    app.listen(3000, () => {
      console.log("Server started");
    });
  } catch (e) {
    console.log(e.message);
    process.exit(1);
  }
};
initialize();

const printResult = (eachTodo) => ({
  id: eachTodo["id"],
  todo: eachTodo["todo"],
  priority: eachTodo["priority"],
  category: eachTodo["category"],
  status: eachTodo["status"],
  dueDate: eachTodo["due_date"],
});

const todoArray = {
  priority: ["HIGH", "MEDIUM", "LOW"],
  category: ["WORK", "HOME", "LEARNING"],
  status: ["TO DO", "IN PROGRESS", "DONE"],
};

const invalidResponseTextObject = {
  status: "Invalid Todo Status",
  priority: "Invalid Todo Priority",
  category: "Invalid Todo Category",
  dueDate: "Invalid Due Date",
};

const isValidProperty = (property, value) =>
  todoArray[property].includes(value);

const invalidResponse = (responseObj, value) => {
  responseObj.status(400);
  responseObj.send(invalidResponseTextObject[value]);
};

const isValidDueDate = (referenceDate) => {
  const parsedDueDate = parse(referenceDate, "yyyy-MM-dd", new Date());
  return isValid(parsedDueDate);
};

const getFormattedDueDate = (referenceDate) =>
  format(new Date(referenceDate), "yyyy-MM-dd");

app.get("/todos/", async (request, response) => {
  const { status, priority, search_q = "", category } = request.query;
  let queryGet = `select * from todo where todo like '%${search_q}%'`;
  if (status !== undefined) {
    if (isValidProperty("status", status)) {
      queryGet += ` and status='${status}'`;
    } else {
      invalidResponse(response, "status");
      return;
    }
  }
  if (priority !== undefined) {
    if (isValidProperty("priority", priority)) {
      queryGet += ` and priority='${priority}'`;
    } else {
      invalidResponse(response, "priority");
      return;
    }
  }
  if (category !== undefined) {
    if (isValidProperty("category", category)) {
      queryGet += ` and category='${category}'`;
    } else {
      invalidResponse(response, "category");
      return;
    }
  }
  const data = await database.all(queryGet);
  let myArray = data.map((eachTodo) => printResult(eachTodo));
  response.send(myArray);
});

app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const queryGet = `select * from todo where id=${todoId}`;
  const data = await database.get(queryGet);
  response.send(printResult(data));
});

app.get("/agenda/", async (request, response) => {
  const { date } = request.query;
  if (isValidDueDate(date)) {
    const formattedDueDate = getFormattedDueDate(date);
    const queryGet = `select * from todo where due_date='${formattedDueDate}'`;
    const data = await database.all(queryGet);
    const myArray = data.map((eachTodo) => printResult(eachTodo));
    response.send(myArray);
  } else {
    invalidResponse(response, "dueDate");
  }
});

app.post("/todos/", async (request, response) => {
  const { id, todo, priority, status, category, dueDate } = request.body;

  if (!isValidDueDate(dueDate)) {
    invalidResponse(response, "dueDate");
    return;
  } else if (!isValidProperty("priority", priority)) {
    invalidResponse(response, "priority");
    return;
  } else if (!isValidProperty("status", status)) {
    invalidResponse(response, "status");
    return;
  } else if (!isValidProperty("category", category)) {
    invalidResponse(response, "category");
    return;
  } else {
    const formattedDueDate = getFormattedDueDate(dueDate);
    const postTodoQuery = `
  INSERT INTO
    todo (id,todo,priority,status,category,due_date)
  VALUES
    (${id}, '${todo}', '${priority}', '${status}', '${category}' , '${formattedDueDate}');`;
    await database.run(postTodoQuery);
    response.send("Todo Successfully Added");
  }
});

app.put("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const requestBody = request.body;
  let updated = "";
  switch (true) {
    case requestBody.status !== undefined:
      updated = "Status";
      break;
    case requestBody.priority !== undefined:
      updated = "Priority";
      break;
    case requestBody.todo !== undefined:
      updated = "Todo";
      break;
    case requestBody.category !== undefined:
      updated = "Category";
      break;
    case requestBody.dueDate !== undefined:
      updated = "Due Date";
      break;
  }
  if (requestBody.dueDate !== undefined) {
    if (!isValidDueDate(requestBody.dueDate)) {
      invalidResponse(response, "dueDate");
      return;
    }
  } else {
    if (requestBody.status !== undefined) {
      if (!isValidProperty("status", requestBody.status)) {
        invalidResponse(response, "status");
        return;
      }
    }
    if (requestBody.priority !== undefined) {
      if (!isValidProperty("priority", requestBody.priority)) {
        invalidResponse(response, "priority");
        return;
      }
    }
    if (requestBody.category !== undefined) {
      if (!isValidProperty("category", requestBody.category)) {
        invalidResponse(response, "category");
        return;
      }
    }
  }
  const queryNotUpdated = `select * from todo where id=${todoId}`;
  const previousResult = await database.get(queryNotUpdated);
  const {
    status = previousResult.status,
    priority = previousResult.priority,
    category = previousResult.category,
    todo = previousResult.todo,
    dueDate = previousResult.due_date,
  } = request.body;
  const updatedResult = `update todo set todo='${todo}',category='${category}',priority='${priority}',status='${status}',due_date='${dueDate}' where id=${todoId}`;
  await database.run(updatedResult);
  response.send(`${updated} Updated`);
});

app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const queryDelete = `delete from todo where id=${todoId}`;
  await database.run(queryDelete);
  response.send("Todo Deleted");
});

module.exports = app;
