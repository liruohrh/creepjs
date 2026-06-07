/* eslint-disable @typescript-eslint/no-var-requires */
const express = require('express')
const path = require('path')
const fs = require('fs')
const home = path.join(__dirname, '/public')
const app = express()

// report storage directory
const reportDir = path.join(__dirname, 'tmp')

app.use(express.json({ limit: '50mb' }))
app.use(express.static(home))

// redirect /tests/ to /docs/tests
app.use('*', (req, res, next) => {
	const testRoute = /^\/tests\//i.test(req.originalUrl)
	if (testRoute) {
		const url = `/docs${req.originalUrl}`
		return res.redirect(url)
	}
	return next()
})
app.use('/docs', express.static(__dirname + '/docs'))

// Save a single detection's data into ./tmp/{reportId}.json.
// The JSON object is keyed by detection name (`creep` and each test),
// and each request merges its `name` field into the existing file.
const testsPages = fs.readdirSync(path.join(__dirname, 'docs/tests'))
  .filter((e, _, vs) => !["ipaddress", "webrtc", "worker_service"].includes(e.replace(".html", "")) 
    && e.endsWith('.html') && vs.includes(e.replace('.html', '.js')))
  .map(e => e.replace('.html', ''))
  .sort()

app.post('/report/:reportId', (req, res) => {
  const { auto, name, data } = req.body || {}
  if (!name) {
    return res.status(400).json({ message: 'missing "name"' })
  }
  // sanitize reportId to keep it a flat filename (no path traversal)
  const reportId = req.params.reportId || '';
  const filename = reportId.replace(/[^a-zA-Z0-9_-]/g, '_') + ".json"
  if (!filename) {
    return res.status(400).json({ message: 'invalid reportId' })
  }

  try {
    fs.mkdirSync(reportDir, { recursive: true })
    const file = path.join(reportDir, filename)

    let report = {}
    if (fs.existsSync(file)) {
      try {
        report = JSON.parse(fs.readFileSync(file, 'utf8')) || {}
      } catch (e) {
        report = {}
      }
    }
    if(report[name] && !auto) {
      return res.status(400).json({ message: `report already has data for "${name}"`, details: { filename, name } })
    }
    if(!report.createAt){
      report.createAt = new Date().toISOString().slice(0, 19)
    }
    report[name] = data
    fs.writeFileSync(file, JSON.stringify(report, null, 2), 'utf8')

    if(auto) {
      const collected = Object.keys(report).filter(e => e !== 'createAt')
      const nexts = testsPages.filter(e=>!collected.includes(e));
      const next = nexts[0];
      const pages = ['creepjs', ...testsPages];
      const data = { reportId, auto, current: next, pages: pages.join(",")};
      if(nexts.length === 0) {
        console.log(`auto collect data: over, size=${pages.length}, reportId=${reportId}`)
        return res.json({ data: { filename, pages, autoOver: true} })
      }
      console.log(`auto collect data: ${pages.indexOf(next)}/${pages.length}, current is ${name}, next is ${next}, reportId=${reportId}`)
      const query = new URLSearchParams(data).toString()
      return res.json({
        data: {
          url: `/docs/tests/${next}.html` + '?' + query.toString(),
          ...data,
          current: name,
          next
        }
      })
    }
    return res.json({ data: { filename } })
  } catch (error) {
    // @ts-ignore
    return res.status(500).json({ message: `failed to save ${name}: ${error.message || error}` })
  }
})

app.listen(8000, () => console.log('⚡'))
