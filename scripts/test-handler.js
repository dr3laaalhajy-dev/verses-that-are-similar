import handler from '../api/challenges/index.js'
import { createMocks } from 'node-mocks-http'

async function test() {
  const { req, res } = createMocks({
    method: 'GET',
  })

  try {
    // @ts-ignore
    await handler(req, res)
    console.log('Status code:', res._getStatusCode())
    console.log('Data:', res._getData())
    console.log('Is ended:', res._isEnd())
  } catch (error) {
    console.error('Handler threw error:', error)
  }
}

test()
