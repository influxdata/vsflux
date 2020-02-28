class Actions {
  constructor (vscode) {
    this.vscode = vscode
  }

  get versionElement () {
    return document.querySelector('#connVersion')
  }

  get hostElement () {
    return document.querySelector('#connHost')
  }

  get tokenElement () {
    return document.querySelector('#connToken')
  }

  get orgElement () {
    return document.querySelector('#connOrg')
  }

  get form () {
    return document.querySelector('form.ui')
  }

  setHost (val) {
    const element = this.hostElement.querySelector('input')
    this.hostElement.querySelector('input').value = val
  }

  hide (element) {
    element.classList.add('hidden')
  }

  show (element) {
    element.classList.remove('hidden')
  }

  get defaultURL () {
    if (this.isV1()) {
      return this.hostElement.dataset.v1
    }

    return this.hostElement.dataset.v2
  }

  toggleToV1 () {
    this.tokenElement.querySelector('input').removeAttribute('required')
    this.orgElement.querySelector('input').removeAttribute('required')
    this.hide(this.tokenElement)
    this.hide(this.orgElement)
    this.hostElement.querySelector('input').removeAttribute('list')
  }

  toggleToV2 () {
    this.show(this.tokenElement)
    this.show(this.orgElement)
    this.tokenElement.querySelector('input').setAttribute('required', 'true')
    this.orgElement.querySelector('input').setAttribute('required', 'true')
    this.hostElement.querySelector('input').setAttribute('list', 'hosts')
  }

  isV1 () {
    return this.versionElement.value === '1'
  }

  toggleOptions () {
    if (this.isV1()) {
      this.toggleToV1()
    }

    if (this.hostElement.querySelector('input').value === '') {
      this.setHost(this.defaultURL)
    }

    this.versionElement.addEventListener('change', () => {
      if (this.isV1()) {
        this.toggleToV1()
      } else {
        this.toggleToV2()
      }

      this.setHost(this.defaultURL)
    })
  }

  save () {
    document.querySelector('#save').addEventListener('click', () => {
      if (!this.validate()) {
        return {}
      }

      this.vscode.postMessage({
        command: 'save',
        ...this.getData()
      })
    })
  }

  testConn () {
    document.querySelector('#testConn').addEventListener('click', () => {
      if (!this.validate()) {
        return {}
      }

      this.vscode.postMessage({
        command: 'testConn',
        ...this.getData()
      })
    })
  }

  getData () {
    const result = {
      connID: document.querySelector('#connID').value,
      connName: document.querySelector('#connName input').value,
      connHost: document.querySelector('#connHost input').value,
      connVersion: document.querySelector('#connVersion').value,
      connToken: '',
      connOrg: ''
    }

    if (result.connVersion !== 1) {
      const connToken = this.tokenElement.querySelector('input').value
      const connOrg = this.orgElement.querySelector('input').value

      return { ...result, connToken, connOrg }
    }

    return result
  }

  validate () {
    if (!this.form.checkValidity()) {
      this.form.reportValidity()
      return false
    }

    return true
  }
}

const vscode = acquireVsCodeApi()
const act = new Actions(vscode)

act.toggleOptions()
act.save()
act.testConn()
