import { check } from 'express-validator'
import { authMiddleware } from '~/middleware/auth'

const cors = require('cors')({ origin: true })
const express = require('express')
const app = express()

app.use(cors)
app.use(express.json())

const router = require('express-promise-router')()

router.post(
  '/health',
  [check('message').exists()],
  require('./api/health/test').handle,
)

router.post(
  '/books/search',
  authMiddleware,
  [check('keyword').isString().notEmpty()],
  require('./api/books/searchBooks').handle,
)

app.use(router)

export default app
