class Actions {
  constructor(vscode = acquireVsCodeApi()) {
    this.vscode = vscode
  }

  save() {
    if (!this.validate()) {
      return
    }
    this.vscode.postMessage({
      command: 'save',
      ...this.getData()
    })
  }

  test() {
    if (!this.validate()) {
      return
    }
    this.vscode.postMessage({
      command: 'testConn',
      ...this.getData()
    })
  }

  bind() {
    document.querySelector('#testConn').addEventListener('click', () => {
      this.test()
    })

    document.querySelector('#save').addEventListener('click', () => {
      this.save()
    })
  }

  /* getters */
  get hostElement() {
    return document.querySelector('#connHost')
  }

  get tokenElement() {
    return document.querySelector('#connToken')
  }

  get orgElement() {
    return document.querySelector('#connOrg')
  }

  get form() {
    return document.querySelector('form')
  }

  /* private api */

  validate() {
    if (!this.form.checkValidity()) {
      this.form.reportValidity()
      return false
    }

    return true
  }

  getData() {
    const disableTLSInput = document.querySelector('#connDisableTLS input')
    const result = {
      connID: document.querySelector('#connID').value,
      orgID: document.querySelector('#orgID').value,
      connName: document.querySelector('#connName input').value,
      connHost: document.querySelector('#connHost input').value,
      connDisableTLS: disableTLSInput !== null ? disableTLSInput.checked : false,
      connToken: '',
      connOrg: '',
      connUser: '',
      connPass: '',
    }

    // trim trailing slash on connHost input
    let host = result.connHost
    if (host[host.length - 1] === '/') {
      result.connHost = host.slice(0, -1)
    }

    result.connToken = this.tokenElement.querySelector('input').value
    result.connOrg = this.orgElement.querySelector('input').value

    return result
  }

  setHost(val) {
    this.hostElement.querySelector('input').value = val
  }

  hide(element) {
    element.classList.add('hidden')
  }

  show(element) {
    element.classList.remove('hidden')
  }
}

const actions = new Actions()
actions.bind()
