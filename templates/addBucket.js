class Actions {
    constructor(vscode = acquireVsCodeApi()) {
        this.vscode = vscode
    }

    save() {
        if (!this.validate()) {
            return
        }
        this.vscode.postMessage({
            command: 'saveNewBucket',
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
            duration: document.querySelector('#duration select').value
        }
        if (result.duration === "") {
            delete result.duration
        }
        return result
    }

    get form() {
        return document.querySelector('form')
    }
}

const actions = new Actions()
actions.bind()