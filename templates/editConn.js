const vscode = acquireVsCodeApi();
let err = [];
save();
testConn();

function save() {
  document.getElementById("save").addEventListener("click", () => {
    let data = getData();
    if (err.length > 0) {
      return {};
    }
    vscode.postMessage({
      command: "save",
      connID: data.connID,
      connName: data.connName,
      connHost: data.connHost,
      connToken: data.connToken,
      connOrg: data.connOrg
    });
  });
}

function testConn() {
  document.getElementById("testConn").addEventListener("click", () => {
    let data = getData();
    if (err.length > 0) {
      return {};
    }
    vscode.postMessage({
      command: "testConn",
      connName: data.connName,
      connHost: data.connHost,
      connToken: data.connToken,
      connOrg: data.connOrg
    });
  });
}

function getData() {
  err = [];
  let connID = validTextInput("connID", "");
  let connName = validTextInput(
    "connName",
    "Name is invalid for the connection"
  );
  let connHost = validTextInput(
    "connHost",
    "Host URI is invalid for the connection"
  );
  let connToken = validTextInput(
    "connToken",
    "Token is empty for the connection"
  );
  let connOrg = validTextInput("connOrg", "Org is invalid for the connection");
  if (err.length > 0) {
    return {};
  }
  return {
    connID: connID,
    connName: connName,
    connHost: connHost,
    connToken: connToken,
    connOrg: connOrg
  };
}

function validTextInput(id, errMsg) {
  let wrapper = document.getElementById(id);
  let input = wrapper.getElementsByTagName("input")[0];
  if (input.value.trim() === "" && errMsg !== "") {
    wrapper.classList.add("error");
    err.push(errMsg);
    return "";
  }
  return input.value.trim();
}
