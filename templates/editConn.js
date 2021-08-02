class Actions {
  constructor(vscode = acquireVsCodeApi()) {
    this.vscode = vscode

    if (this.isV1) {
      this.toggleToV1()
    }

    if (this.isHostEmpty) {
      this.resetHost()
    }
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

    this.versionElement.addEventListener('change', () => {
      this.toggleOptions()
    })
  }

  /* getters */
  get isHostEmpty() {
    return this.hostElement.querySelector('input').value === ''
  }

  get versionElement() {
    return document.querySelector('#connVersion')
  }

  get hostElement() {
    return document.querySelector('#connHost')
  }

  get tokenElement() {
    return document.querySelector('#connToken')
  }

  get orgElement() {
    return document.querySelector('#connOrg')
  }

  get usernameElement() {
    return document.querySelector('#connUser')
  }

  get passwordElement() {
    return document.querySelector('#connPass')
  }

  get form() {
    return document.querySelector('form')
  }

  get isV1() {
    return this.versionElement.value === '1'
  }

  get defaultURL() {
    return this.isV1 ? this.hostElement.dataset.v1 : ''
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
    const result = {
      connID: document.querySelector('#connID').value,
      connName: document.querySelector('#connName input').value,
      connHost: document.querySelector('#connHost input').value,
      connVersion: document.querySelector('#connVersion').value,
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

    if (result.connVersion === "0") {
      result.connToken = this.tokenElement.querySelector('input').value
      result.connOrg = this.orgElement.querySelector('input').value
    } else {
      result.connUser = this.usernameElement.querySelector('input').value
      result.connPass = this.passwordElement.querySelector('input').value
    }

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

  toggleToV1() {
    this.hide(this.tokenElement)
    const tokenElementInput = this.tokenElement.querySelector('input')
    tokenElementInput.removeAttribute('required')
    tokenElementInput.setAttribute('disabled', 'true')

    this.hide(this.orgElement)
    const orgElementInput = this.orgElement.querySelector('input')
    orgElementInput.removeAttribute('required')
    orgElementInput.setAttribute('disabled', 'true')

    this.show(this.usernameElement)
    const usernameElementInput = this.usernameElement.querySelector('input')
    usernameElementInput.removeAttribute('disabled')
    usernameElementInput.setAttribute('required', 'true')

    this.show(this.passwordElement)
    const passwordElementInput = this.passwordElement.querySelector('input')
    passwordElementInput.removeAttribute('disabled')
    passwordElementInput.setAttribute('required', 'true')

    this.hostElement.querySelector('input').removeAttribute('list')
  }

  toggleToV2() {
    this.hide(this.usernameElement)
    const usernameElementInput = this.usernameElement.querySelector('input')
    usernameElementInput.removeAttribute('required')
    usernameElementInput.setAttribute('disabled', 'true')

    this.hide(this.passwordElement)
    const passwordElementInput = this.passwordElement.querySelector('input')
    passwordElementInput.removeAttribute('required')
    passwordElementInput.setAttribute('disabled', 'true')

    this.show(this.tokenElement)
    const tokenElementInput = this.tokenElement.querySelector('input')
    tokenElementInput.removeAttribute('disabled')
    tokenElementInput.setAttribute('required', 'true')

    this.show(this.orgElement)
    const orgElementInput = this.orgElement.querySelector('input')
    orgElementInput.removeAttribute('disabled')
    orgElementInput.setAttribute('required', 'true')

    this.hostElement.querySelector('input').setAttribute('list', 'hosts')
  }

  resetHost() {
    this.setHost(this.defaultURL)
  }

  toggleOptions() {
    this.isV1 ? this.toggleToV1() : this.toggleToV2()
    this.resetHost()
  }
}

const actions = new Actions()
actions.bind()
