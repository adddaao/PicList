import https from 'node:https'
import axios, { AxiosResponse } from 'axios'

import type { IStringKeyMap } from '#/types/types'
import { deleteFailedLog, deleteLog } from '~/utils/deleteLog'
import { ensureHTTPLink } from '~/server/utils'
import logger from '@core/picgo/logger'

/**
 * EasyImages 删除实现
 */
export default class EasyImagesApi {
  /**
   * 执行云删除
   */
  static async delete(configMap: IStringKeyMap): Promise<boolean> {
    const { config, del, hash } = configMap
    const hasDel = typeof del === 'string' && del.length > 0
    const hasHash = typeof hash === 'string' && hash.length > 0
    if (!hasDel && !hasHash) {
      deleteLog(hash || del, 'EasyImages', false, 'EasyImagesApi.delete: invalid params')
      return false
    }
    let url = ''
    if (hasDel) {
      const d = del as string
      if (d.startsWith('http://') || d.startsWith('https://')) {
        url = d
      } else if (d.startsWith('/')) {
        url = `${ensureHTTPLink(config?.host || '')}${d}`
      } else {
        url = `${ensureHTTPLink(config?.host || '')}/${d}`
      }
    } else if (config?.host && hasHash) {
      url = `${ensureHTTPLink(config.host)}/app/del.php?hash=${hash}`
    } else {
      deleteLog(hash, 'EasyImages', false, 'EasyImagesApi.delete: invalid host')
      return false
    }
    try { logger.info(`[EasyImages] 删除入参: ${JSON.stringify({ del, hash, host: config?.host })}`) } catch { }
    try { logger.info(`[EasyImages] 删除URL: ${url}`) } catch { }
    try {
      const agent = new https.Agent({ rejectUnauthorized: false })
      const response: AxiosResponse = await axios.get(url, {
        timeout: 30000,
        httpsAgent: agent,
        headers: { Accept: 'application/json' }
      })
      try { logger.info(`[EasyImages] 响应状态: ${response.status}`) } catch { }
      try { logger.info(`[EasyImages] 响应数据: ${typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data)}`) } catch { }
      const isJSON = typeof response.data === 'object'
      const okJSON = isJSON && (response.data?.code === 200 || response.data?.type === 'success' || response.data?.result === 'success')
      const ok = okJSON || (!isJSON && response.status === 200)
      deleteLog(hash || del, 'EasyImages', ok)
      return ok
    } catch (error: any) {
      try { logger.error(`[EasyImages] 删除错误: ${error?.message || error}`) } catch { }
      deleteFailedLog(hash || del, 'EasyImages', error)
      return false
    }
  }
}
