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
  let connID = document.getElementById("connID").value;
  let connName = validTextInput("connName", "Name is empty for the connection");
  let connHost = validTextInput(
    "connHost",
    "Host URI is empty for the connection"
  );
  let connToken = validTextInput(
    "connToken",
    "Token is empty for the connection",
    "^[-A-Za-z0-9+=]{1,50}|=[^=]|={3,}$",
    "Token should be a valid base64 encoded string"
  );
  let connOrg = validTextInput("connOrg", "Org is empty for the connection");
  let errMsgs = document.getElementById("errMsgs");
  if (err.length > 0) {
    errMsgs.innerHTML = "";
    errMsgs.classList.remove("hidden");
    err.forEach(ele => {
      var pNode = document.createElement("p"); // Create a <li> node
      pNode.appendChild(document.createTextNode(ele));
      errMsgs.appendChild(pNode);
    });
    return {};
  } else {
    errMsgs.innerHTML = "";
    errMsgs.classList.add("hidden");
  }
  return {
    connID: connID,
    connName: connName,
    connHost: connHost,
    connToken: connToken,
    connOrg: connOrg
  };
}

function validTextInput(id, errMsg, regex, regexErr) {
  let wrapper = document.getElementById(id);
  let input = wrapper.getElementsByTagName("input")[0];
  wrapper.classList.remove("error");
  let v = input.value.trim();
  if (v === "") {
    wrapper.classList.add("error");
    err.push(errMsg);
    return "";
  }
  if (regex && regexErr) {
    if (!v.match(regex)) {
      wrapper.classList.add("error");
      err.push(regexErr);
      return "";
    }
  }
  return v;
}
