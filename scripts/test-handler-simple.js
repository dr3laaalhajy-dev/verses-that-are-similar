import handler from '../api/challenges/index.js'

async function test() {
  const req = { method: 'GET' }
  const res = {
    status: (code) => {
      console.log('Status set to:', code)
      return res
    },
    json: (data) => {
      console.log('JSON response:', JSON.stringify(data, null, 2))
      return res
    }
  }

  try {
    await handler(req, res)
  } catch (error) {
    console.error('Error in handler:', error)
  }
}

test()
