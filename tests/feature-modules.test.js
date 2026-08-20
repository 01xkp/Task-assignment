import assert from 'node:assert/strict'
import test from 'node:test'
import { featureForPrd, groupPrdsByFeature, mergeFeaturePrds } from '../shared/feature-modules.js'

test('uses a folder name as the stable feature identity', () => {
  assert.deepEqual(
    featureForPrd({ id: 'prd-1', sourceType: 'file', sourceLabel: '内测邀请码注册-v2/负责人验收.md', title: '负责人验收' }),
    { featureKey: 'folder:内测邀请码注册-v2', featureName: '内测邀请码注册' },
  )
})

test('uses the nested ZIP folder and keeps standalone sources isolated', () => {
  assert.equal(
    featureForPrd({ id: 'prd-1', sourceType: 'file', sourceLabel: '资料.zip!/内测邀请码注册-v2/开发版.md', title: '开发阅读版' }).featureKey,
    'folder:内测邀请码注册-v2',
  )
  assert.equal(
    featureForPrd({ id: 'prd-2', sourceType: 'text', sourceLabel: '手动粘贴', title: '独立需求' }).featureKey,
    'prd:prd-2',
  )
})

test('groups complementary source documents and labels the merged content', () => {
  const [group] = groupPrdsByFeature([
    { id: 'prd-dev', title: '开发阅读版', sourceType: 'file', sourceLabel: '内测邀请码注册-v2/开发.md', content: '开发范围' },
    { id: 'prd-acceptance', title: '负责人验收', sourceType: 'file', sourceLabel: '内测邀请码注册-v2/验收.md', content: '验收标准' },
  ])

  assert.deepEqual(group.prdIds, ['prd-dev', 'prd-acceptance'])
  assert.equal(group.featureName, '内测邀请码注册')
  assert.equal(
    mergeFeaturePrds(group).content,
    '来源文档：内测邀请码注册-v2/开发.md\n文档标题：开发阅读版\n\n开发范围\n\n来源文档：内测邀请码注册-v2/验收.md\n文档标题：负责人验收\n\n验收标准',
  )
})
