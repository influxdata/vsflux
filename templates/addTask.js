class Actions {
    constructor(vscode = acquireVsCodeApi()) {
        this.vscode = vscode
    }

    save() {
        if (!this.validate()) {
            return
        }
        this.vscode.postMessage({
            command: 'saveNewTask',
            ...this.getData()
        })
    }

    bind() {
        document.querySelector('#save').addEventListener('click', () => {
            this.save()
        })
        const type = document.querySelector('#type')
        type.addEventListener('change', () => {
            if (type.value === "0") {
                document.querySelector('#every').classList.remove('hidden')
                document.querySelector('#cron').classList.add('hidden')
            } else {
                document.querySelector('#cron').classList.remove('hidden')
                document.querySelector('#every').classList.add('hidden')
            }
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
            every: document.querySelector('#every input').value,
            cron: document.querySelector('#cron input').value,
            offset: document.querySelector('#offset input').value
        }
        if (result.every === "") {
            delete result.every
        }
        if (result.cron === "") {
            delete result.cron
        }
        console.log(result)
        return result
    }

    get form() {
        return document.querySelector('form')
    }
}

const actions = new Actions()
actions.bind()