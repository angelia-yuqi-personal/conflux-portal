import assert from 'assert'
import nock from 'nock'
import sinon from 'sinon'
import ObservableStore from 'obs-store'
import DetectTokensController from '../../../../app/scripts/controllers/detect-tokens'
import NetworkController from '../../../../app/scripts/controllers/network/network'
import PreferencesController from '../../../../app/scripts/controllers/preferences'

describe('DetectTokensController', function () {
  const sandbox = sinon.createSandbox()
  let clock, keyringMemStore, network, preferences, controller

  const noop = () => {}

  const networkControllerProviderConfig = {
    getAccounts: noop,
  }

  beforeEach(async function () {
    nock('https://api.infura.io')
      .get(/.*/)
      .reply(200)

    keyringMemStore = new ObservableStore({ isUnlocked: false })
    network = new NetworkController()
    network.initializeProvider(networkControllerProviderConfig)
    preferences = new PreferencesController({ network })

    controller = new DetectTokensController({
      preferences: preferences,
      network: network,
      keyringMemStore: keyringMemStore,
    })
  })

  after(function () {
    sandbox.restore()
    nock.cleanAll()
  })

  it('should poll on correct interval', async function () {
    const stub = sinon.stub(global, 'setInterval')
    new DetectTokensController({ interval: 1337 }) // eslint-disable-line no-new
    assert.strictEqual(stub.getCall(0).args[1], 1337)
    stub.restore()
  })

  it('should be called on every polling period', async function () {
    clock = sandbox.useFakeTimers()
    const network = new NetworkController()
    network.initializeProvider(networkControllerProviderConfig)
    network.setProviderType('mainnet')
    const preferences = new PreferencesController({ network })
    const controller = new DetectTokensController({
      preferences: preferences,
      network: network,
      keyringMemStore: keyringMemStore,
    })
    controller.isOpen = true
    controller.isUnlocked = true

    const stub = sandbox.stub(controller, 'detectNewTokens')

    clock.tick(1)
    sandbox.assert.notCalled(stub)
    clock.tick(180000)
    sandbox.assert.called(stub)
    clock.tick(180000)
    sandbox.assert.calledTwice(stub)
    clock.tick(180000)
    sandbox.assert.calledThrice(stub)
  })

  it('should not check tokens while in test network', async function () {
    controller.isOpen = true
    controller.isUnlocked = true

    const stub = sandbox
      .stub(controller, 'detectTokenBalance')
      .withArgs('0x0D262e5dC4A06a0F1c90cE79C7a60C09DfC884E4')
      .returns(true)
      .withArgs('0xBC86727E770de68B1060C91f6BB6945c73e10388')
      .returns(true)

    await controller.detectNewTokens()
    sandbox.assert.notCalled(stub)
  })

  it('should only check and add tokens while in main network', async function () {
    const controller = new DetectTokensController({ preferences: preferences, network: network, keyringMemStore: keyringMemStore })
    controller.isOpen = true
    controller.isUnlocked = true

    sandbox
      .stub(controller, 'detectTokenBalance')
      .withArgs('0x0D262e5dC4A06a0F1c90cE79C7a60C09DfC884E4')
      .returns(
        preferences.addToken(
          '0x0d262e5dc4a06a0f1c90ce79c7a60c09dfc884e4',
          'J8T',
          8
        )
      )
      .withArgs('0xBC86727E770de68B1060C91f6BB6945c73e10388')
      .returns(
        preferences.addToken(
          '0xbc86727e770de68b1060c91f6bb6945c73e10388',
          'XNK',
          18
        )
      )

    await controller.detectNewTokens()
    assert.deepEqual(preferences.store.getState().tokens, [
      {
        address: '0x0d262e5dc4a06a0f1c90ce79c7a60c09dfc884e4',
        decimals: 8,
        symbol: 'J8T',
      },
      {
        address: '0xbc86727e770de68b1060c91f6bb6945c73e10388',
        decimals: 18,
        symbol: 'XNK',
      },
    ])
  })

  it('should not detect same token while in main network', async function () {
    preferences.addToken('0x0d262e5dc4a06a0f1c90ce79c7a60c09dfc884e4', 'J8T', 8)
    const controller = new DetectTokensController({
      preferences: preferences,
      network: network,
      keyringMemStore: keyringMemStore,
    })
    controller.isOpen = true
    controller.isUnlocked = true

    sandbox
      .stub(controller, 'detectTokenBalance')
      .withArgs('0x0D262e5dC4A06a0F1c90cE79C7a60C09DfC884E4')
      .returns(
        preferences.addToken(
          '0x0d262e5dc4a06a0f1c90ce79c7a60c09dfc884e4',
          'J8T',
          8
        )
      )
      .withArgs('0xBC86727E770de68B1060C91f6BB6945c73e10388')
      .returns(
        preferences.addToken(
          '0xbc86727e770de68b1060c91f6bb6945c73e10388',
          'XNK',
          18
        )
      )

    await controller.detectNewTokens()
    assert.deepEqual(preferences.store.getState().tokens, [
      {
        address: '0x0d262e5dc4a06a0f1c90ce79c7a60c09dfc884e4',
        decimals: 8,
        symbol: 'J8T',
      },
      {
        address: '0xbc86727e770de68b1060c91f6bb6945c73e10388',
        decimals: 18,
        symbol: 'XNK',
      },
    ])
  })

  it('should trigger detect new tokens when change address', async function () {
    controller.isOpen = true
    controller.isUnlocked = true
    const stub = sandbox.stub(controller, 'detectNewTokens')
    await preferences.setSelectedAddress(
      '0xbc86727e770de68b1060c91f6bb6945c73e10388'
    )
    sandbox.assert.called(stub)
  })

  it('should trigger detect new tokens when submit password', async function () {
    controller.isOpen = true
    controller.selectedAddress = '0x0'
    const stub = sandbox.stub(controller, 'detectNewTokens')
    await controller._keyringMemStore.updateState({ isUnlocked: true })
    sandbox.assert.called(stub)
  })

  it('should not trigger detect new tokens when not open or not unlocked', async function () {
    controller.isOpen = true
    controller.isUnlocked = false
    const stub = sandbox.stub(controller, 'detectTokenBalance')
    clock.tick(180000)
    sandbox.assert.notCalled(stub)
    controller.isOpen = false
    controller.isUnlocked = true
    clock.tick(180000)
    sandbox.assert.notCalled(stub)
  })
})
