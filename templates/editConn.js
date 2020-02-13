class Actions {
  constructor(hasErr, vscode) {
    this.hasErr = hasErr;
    this.vscode = vscode;
  }

  save() {
    document.getElementById("save").addEventListener("click", () => {
      let data = this.getData();
      if (this.hasErr) {
        return {};
      }
      this.vscode.postMessage({
        command: "save",
        connID: data.connID,
        connName: data.connName,
        connHost: data.connHost,
        connToken: data.connToken,
        connOrg: data.connOrg,
        connDefault: data.connDefault
      });
    });
  }

  testConn() {
    document.getElementById("testConn").addEventListener("click", () => {
      let data = this.getData();
      if (this.hasErr) {
        return {};
      }
      this.vscode.postMessage({
        command: "testConn",
        connName: data.connName,
        connHost: data.connHost,
        connToken: data.connToken,
        connOrg: data.connOrg
      });
    });
  }

  getData() {
    this.hasErr = false;
    let connID = document.getElementById("connID").value;
    let isDefault = document.getElementById("connDefault").checked;
    let connName = this.validTextInput(
      "connName",
      "Name is empty for the connection"
    );
    let connHost = this.validTextInput(
      "connHost",
      "Host URI is empty for the connection"
    );
    let connToken = this.validTextInput(
      "connToken",
      "Token is empty for the connection",
      "^[-A-Za-z0-9+=]{1,50}|=[^=]|={3,}$",
      "Token should be a valid base64 encoded string"
    );
    let connOrg = this.validTextInput(
      "connOrg",
      "Org is empty for the connection"
    );
    if (this.hasErr) {
      return {};
    }
    return {
      connID: connID,
      connName: connName,
      connHost: connHost,
      connToken: connToken,
      connOrg: connOrg,
      connDefault: isDefault
    };
  }

  validTextInput(id, errMsg, regex, regexErr) {
    let wrapper = document.getElementById(id);
    let input = wrapper.getElementsByTagName("input")[0];
    this.clearErr(wrapper);
    let v = input.value.trim();
    if (v === "") {
      this.setErr(wrapper, errMsg);
      return "";
    }
    if (regex && regexErr) {
      if (!v.match(regex)) {
        this.setErr(wrapper, regexErr);
        return "";
      }
    }
    return v;
  }

  clearErr(wrapper) {
    wrapper.classList.remove("error");
    let ele = wrapper.getElementsByClassName("errMsg")[0];
    ele.innerHTML = "";
    ele.classList.add("hidden");
    return ele;
  }

  setErr(wrapper, errMsg) {
    let ele = this.clearErr(wrapper);
    ele.classList.remove("hidden");
    wrapper.classList.add("error");
    var pNode = document.createElement("p");
    pNode.appendChild(document.createTextNode(errMsg));
    ele.appendChild(pNode);
    this.hasErr = true;
  }
}

const vscode = acquireVsCodeApi();
let act = new Actions(false, vscode);
act.save();
act.testConn();
