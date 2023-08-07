#!/usr/bin/env node
const RAM = require('random-access-memory')
const Hyperswarm = require('hyperswarm')
const crypto = require('hypercore-crypto')

const RPC = require('./rpc.js')
const setState = require('./state.js')
const appHome = require('./appHome.js')

const Corestore = require('corestore')

;(async () => {
  const keyPair = appHome.getKeyPair()
  const swarm = new Hyperswarm({ keyPair })

  const store = new Corestore(RAM)

  swarm.join(crypto.discoveryKey(keyPair.publicKey))
  await swarm.flush()

  console.log('Public key:', appHome.readPk())

  let state = await setState(store)
  let { announcedRefs, repositories, drives } = state
  let oldAnnouncedRefs = Object.keys({ ...announcedRefs }).sort().join(',')

  logRepos(repositories)

  let rpc = new RPC(announcedRefs, repositories, drives)

  appHome.watch(async (event, path) => {
    state = await setState(store, drives)
    announcedRefs = state.announcedRefs
    repositories = state.repositories
    drives = state.drives

    const newAnnouncedRefs = Object.keys({ ...announcedRefs }).sort().join(',')
    if (oldAnnouncedRefs === newAnnouncedRefs) return
    oldAnnouncedRefs = newAnnouncedRefs

    logRepos(repositories)

    rpc = new RPC(announcedRefs, repositories, drives)
  })

  swarm.on('connection', (socket, peerInfo) => {
    socket.on('error', console.error)
    store.replicate(socket)
    rpc.setHandlers(socket, peerInfo)
  })
})()

function logRepos (repositories) {
  for (const repo in repositories) {
    for (const ref in repositories[repo]) console.log(repositories[repo][ref], '\t', ref, '\t', repo)
  }
}
