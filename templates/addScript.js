class Actions {
    constructor(vscode = acquireVsCodeApi()) {
        this.vscode = vscode
    }

    save() {
        if (!this.validate()) {
            return
        }
        this.vscode.postMessage({
            command: 'saveScript',
            ...this.getData()
        })
    }

    bind() {
        document.querySelector('#save').addEventListener('click', () => {
            this.save()
        })
    }

    validate() {
        if (!this.form.checkValidity()) {
            this.form.reportValidity()
            return false
        }
        return true
    }

    getData() {
        const result = {
            name: document.querySelector('#name input').value,
            description: document.querySelector('#description textarea').value,
            language: document.querySelector('#language input').value
        }
        return result
    }

    get form() {
        return document.querySelector('form')
    }
}

const actions = new Actions()
actions.bind()