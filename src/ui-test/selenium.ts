/* eslint-disable promise/param-names */
import { TextEditor, EditorView, Workbench, ContentAssist, WebView, By } from 'vscode-extension-tester'
import { expect, assert } from 'chai'
import fs from 'fs'
import { describe, it } from 'mocha'

describe('VSFLUX UI Tests', async () => {
  it('test static assist', async () => {
    const editor = await OpenANewFile()
    editor.setText('from')
    const assist = await editor.toggleContentAssist(true) as ContentAssist
    const items = await assist.getItems()
    assert.isTrue(items.length > 0)
    deleteFile()
  })

  it('test new connection page', async () => {
    const workbench = new Workbench()
    await workbench.executeCommand('InfluxDB: Add Connection')
    await new Promise((res) => { setTimeout(res, 300) })
    const view = new WebView(undefined, 'Add Connection')
    await view.switchToFrame()
    expect(view.getTitle, 'Add Connection')
    const hTitle = await (await view.findWebElement(By.tagName('h4'))).getText()
    expect(hTitle, 'Add Connection')

    const connName = await (await view.findWebElement(By.id('connName'))).findElement(By.tagName('input'))
    const connHost = await (await view.findWebElement(By.id('connHost'))).findElement(By.tagName('input'))
    const connToken = await (await view.findWebElement(By.id('connToken'))).findElement(By.tagName('input'))
    const connOrg = await (await view.findWebElement(By.id('connOrg'))).findElement(By.tagName('input'))

    // check required
    assert.equal(await connName.getAttribute('required'), 'true', 'conn name v2')
    assert.equal(await connHost.getAttribute('required'), 'true', 'conn host v2')
    assert.equal(await connToken.getAttribute('required'), 'true', 'conn token v2')
    assert.equal(await connOrg.getAttribute('required'), 'true', 'conn org1 v2')
  }).timeout(8000)
})

const filepath = '/tmp/my.flux'

function deleteFile () {
  fs.unlinkSync(filepath)
}

async function OpenANewFile ():Promise<TextEditor> {
  // create a file in fs
  fs.writeFileSync(filepath, '')

  const workbench = new Workbench()
  const commandInput = await workbench.openCommandPrompt()
  await commandInput.setText(filepath)
  await commandInput.confirm()
  const editor = new TextEditor(new EditorView(), 'my.flux')
  const ss = await editor.getText()
  expect(ss, '')
  return editor
}
