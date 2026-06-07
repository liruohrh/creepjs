/**
 * Shared report helper for the test pages.
 *
 * Reads the `reportId` query string parameter from the page URL and POSTs the
 * test's detection data to the server's /report/{reportId} endpoint, which
 * stores it into ./tmp/{reportId}.json under the given `name` field.
 *
 * If there is no `reportId` parameter, nothing is sent.
 *
 * @param {string} name - the detection/test name (becomes a field in the report)
 * @param {{}} data - the detection data to store
 * @param {{
 *  reportId: string, 
 *  reportAuto: boolean
 * }} options
 */
let isReporting = false
function reportTest(name, data, options = {}) {
  // Save data in a <script type="application/json"> element in the DOM
  const existing = document.getElementById(`report-data`)
  if (existing) {
    existing.textContent = JSON.stringify({
      ...JSON.parse(existing.textContent),
      [name]: data
    })
  } else {
    const script = document.createElement('script')
    script.type = 'application/json'
    script.id = `report-data`
    script.textContent = JSON.stringify({ [name]: data })
    document.body.appendChild(script)
  }

  const query = new URLSearchParams(window.location.search)
  const reportId = options.reportId || query.get('reportId')
  const auto = options.reportAuto || query.has('auto')
  if (!reportId) {
    return
  }
  isReporting = true
  fetch(`/report/${encodeURIComponent(reportId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ auto, name, data }),
  })
    .then((e) => e.json())
    .then((e) => {
      console.log(`Report sent for ${name}`, e)
      if (!e.data.url) {
        if (e.data.autoOver) {
          toast(`auto collect data: over\nsave on ${e.data.filename}\npages=${JSON.stringify(Object.assign({}, ...e.data.pages.map((e,i)=>({[i+1]:e}))))}`, { timeout: 500000 })
        }
        return
      }
      const pages = e.data.pages.split(',')
      toast(
        `auto collect data\nis going to page "${e.data.next}": ${pages.indexOf(e.data.next) + 1}/${pages.length}\npages=${JSON.stringify(Object.assign({}, ...pages.map((e,i)=>({[i+1]:e}))))}}`,
        {
          btnLabel: 'cancel',
          onClose: (timeout) => {
            if (timeout) {
              if (e.data.url.startsWith('http')) {
                window.location.href = e.data.url
              } else {
                window.location.href = window.location.origin + e.data.url
              }
            }
          },
          onBtn: (close) => {
            close()
            toast('canceled')
          },
        },
      )
    })
    .catch((e) => {
      console.warn(`Failed to send report for ${name}: `, e)
    })
}
;(async () => {
  if (isReporting) return
  const query = [...new URLSearchParams(window.location.search)].reduce((res, [k, v]) => {
    if (Array.isArray(res[k])) {
      res[k].push(v)
    } else if (res[k] !== undefined && res[k] !== null) {
      res[k] = [res[k], v]
    } else {
      res[k] = v
    }
    return res
  }, {})
  if (!query.pages || !query.current || !query.length) {
    return
  }
  const pages = query.pages.split(',')
  toast(`auto collecting data ${pages.indexOf(query.current) + 1}/${pages.length}\npages=${JSON.stringify(Object.assign({}, ...pages.map((e,i)=>({[i+1]:e}))))}}`)
})()
function __createElement(tag, props = {}) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (k === 'style') {
      Object.assign(el.style, v)
    } else if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2), v)
    } else {
      el[k] = v
    }
  }
  return el
}
function toast(message, options = { btnLabel: '', onClose: null, onBtn: null, timeout: 3000 }) {
  if (!options.timeout) options.timeout = 3000
  const oldEl = document.getElementById('_toast')
  if (oldEl) oldEl.remove()
  const el = Object.assign(document.createElement('div'), { id: '_toast' })
  Object.assign(el.style, {
    position: 'fixed',
    bottom: '50%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#854F0B',
    color: '#FAEEDA',
    padding: '12px 16px',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    fontSize: '14px',
    width: '360px',
    zIndex: 9999,
  })
  const messageEl = __createElement('div', {
    style: {
      lineHeight: '1.6',
      // display: 'flex',
      // flexDirection: 'column',
      maxHeight: '300px',
      overflowY: 'auto',
      wordBreak: 'break-word',
    },
  })
  el.appendChild(messageEl)
  messageEl.append(
    ...message.split('\n').map((line) => {
      return [__createElement('span', {
        textContent: line,
      }), __createElement('br')]
    }).flat(),
  )
  el.appendChild(
    __createElement('span', {
      textContent: `(close after ${options.timeout >= 1000 ? `${Math.floor(options.timeout / 1000)}s` : `${options.timeout}ms`})`,
      style: {
        color: '#d7613d',
      },
    }),
  )
  let timer
  const close = (timeout = false) => {
    if (timer !== window._toastTimer) return
    if (timer) clearTimeout(timer)
    const el = document.getElementById('_toast')
    if (el) el.remove()
    if (options.onClose) options.onClose(timeout)
  }
  if (options.btnLabel) {
    const btn = Object.assign(document.createElement('button'), { textContent: options.btnLabel })
    Object.assign(btn.style, {
      background: 'rgba(255,255,255,0.15)',
      border: 'none',
      color: '#FAEEDA',
      padding: '4px 10px',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
      alignSelf: 'flex-end',
    })
    btn.onclick = () => {
      if (options.onBtn) options.onBtn(close)
    }
    el.appendChild(btn)
  }
  window._toastTimer = timer = setTimeout(() => close(true), options.timeout)
  document.body.appendChild(el)
}
