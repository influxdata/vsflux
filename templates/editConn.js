class Actions {
  constructor (hasErr, vscode) {
    this.hasErr = hasErr
    this.vscode = vscode
  }

  toggleOptions () {
    const connVersionEle = document.getElementById('connVersion')
    if (connVersionEle.value === 1) {
      document.getElementById('connToken').classList.add('hidden')
      document.getElementById('connOrg').classList.add('hidden')
    }
    connVersionEle.addEventListener('change', () => {
      if (connVersionEle.value === 1) {
        document.getElementById('connToken').classList.add('hidden')
        document.getElementById('connOrg').classList.add('hidden')
      } else {
        document.getElementById('connToken').classList.remove('hidden')
        document.getElementById('connOrg').classList.remove('hidden')
      }
      const temp = document
        .getElementById('connHost')
        .getElementsByTagName('input')[0].value
      document
        .getElementById('connHost')
        .getElementsByTagName('input')[0].value = document.getElementById(
          'alternativeHost'
        ).innerText
      document.getElementById('alternativeHost').innerText = temp
    })
  }

  save () {
    document.getElementById('save').addEventListener('click', () => {
      const data = this.getData()
      if (this.hasErr) {
        return {}
      }
      this.vscode.postMessage({
        command: 'save',
        connVersion: data.connVersion,
        connID: data.connID,
        connName: data.connName,
        connHost: data.connHost,
        connToken: data.connToken,
        connOrg: data.connOrg
      })
    })
  }

  testConn () {
    document.getElementById('testConn').addEventListener('click', () => {
      const data = this.getData()
      if (this.hasErr) {
        return {}
      }
      this.vscode.postMessage({
        command: 'testConn',
        connVersion: data.connVersion,
        connName: data.connName,
        connHost: data.connHost,
        connToken: data.connToken,
        connOrg: data.connOrg
      })
    })
  }

  getData () {
    this.hasErr = false
    const connID = document.getElementById('connID').value
    const connName = this.validTextInput(
      'connName',
      'Name is empty for the connection'
    )
    const connHost = this.validTextInput(
      'connHost',
      'Host URI is empty for the connection'
    )
    let connToken, connOrg
    const connVersion = document.getElementById('connVersion').value
    if (connVersion === 1) {
      connToken = ''
      connOrg = ''
    } else {
      connToken = this.validTextInput(
        'connToken',
        'Token is empty for the connection',
        '^[-A-Za-z0-9+=]{1,50}|=[^=]|={3,}$',
        'Token should be a valid base64 encoded string'
      )
      connOrg = this.validTextInput(
        'connOrg',
        'Org is empty for the connection'
      )
    }

    if (this.hasErr) {
      return {}
    }
    return {
      connVersion: connVersion,
      connID: connID,
      connName: connName,
      connHost: connHost,
      connToken: connToken,
      connOrg: connOrg
    }
  }

  validTextInput (id, errMsg, regex, regexErr) {
    const wrapper = document.getElementById(id)
    const input = wrapper.getElementsByTagName('input')[0]
    this.clearErr(wrapper)
    const v = input.value.trim()
    if (v === '') {
      this.setErr(wrapper, errMsg)
      return ''
    }
    if (regex && regexErr) {
      if (!v.match(regex)) {
        this.setErr(wrapper, regexErr)
        return ''
      }
    }
    return v
  }

  clearErr (wrapper) {
    wrapper.classList.remove('error')
    const ele = wrapper.getElementsByClassName('errMsg')[0]
    ele.innerHTML = ''
    ele.classList.add('hidden')
    return ele
  }

  setErr (wrapper, errMsg) {
    const ele = this.clearErr(wrapper)
    ele.classList.remove('hidden')
    wrapper.classList.add('error')
    var pNode = document.createElement('p')
    pNode.appendChild(document.createTextNode(errMsg))
    ele.appendChild(pNode)
    this.hasErr = true
  }
}

const vscode = acquireVsCodeApi()
const act = new Actions(false, vscode)
act.toggleOptions()
act.save()
act.testConn()
