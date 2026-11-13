# 重设计素材 V2（2026-11-13）

使用内置 image_gen 生成，旧素材保留。运行时直接采样 4×2 图集，爆炸和波纹加径向遮罩压低跨格光晕，无需重复导出单帧。

| 文件 | 用途 | 状态 |
|---|---|---|
| scene/background/orbital-nebula-v2.png | 星云、行星与空间站背景 | 已接入 |
| scene/foreground/asteroids-v2.png | 独立小行星前景，可用于轻微视差 | 已接入，2172×724，带 Alpha |
| scene/shield/arc-v2.png | 蓝青蜂窝弧形护罩 | 已接入，1774×887，带 Alpha |
| scene/shield/impact-sheet-v2.png | 八阶段护罩撞击波纹 | 已接入，使用帧边缘遮罩 |
| combat/v2/explosion-sheet.png | 八阶段火球、碎片、烟雾爆炸 | 已接入，使用帧边缘遮罩 |
| combat/v2/effects-atlas-clean.png | 普通弹、穿甲弹、炮口、命中、尾焰、烟雾、裂纹、碎片 | 已接入，按格采样 |
| combat/v2/effects-atlas.png | 上述图集初版 | 白色底残留，勿接入 |

飞船复用 ships/ 中玩家及四类敌机。文字、血条、HUD 使用运行时绘制，以支持任意词组和窗口尺寸；护罩受损配色与能量流动由运行时实现，不需要重复生成静态图片。大小爆炸可共享序列并采用不同显示尺寸及播放参数。

## 生成提示词记录

共同约束：semi realistic military science fiction production game asset, transparent background, no text, no HUD, no ships。

- 护罩：wide shallow cyan blue energy shield dome arc, sophisticated holographic honeycomb mesh conforming to curved surface, translucent energy film, restrained luminous rim, no base, complete arc with transparent margins.
- 爆炸：4 columns 2 rows eight equal cells, coherent sequence: tiny white flash, orange ignition, turbulent fireball, peak fire and metal shards, smoky fire, dark smoke and embers, fading smoke, final embers; consistent centers, no clipping, cinematic volumetric fire.
- 特效：4 columns 2 rows; blue upward plasma projectile, green armor piercing bolt, blue muzzle flash, orange impact spark, downward blue exhaust, gray smoke, charred cracks, metal debris.
- 特效修正：remove ALL white backdrop to true alpha, preserve eight effects/colors, keep layout, shrink effects to central 60 percent with padding, preserve luminous white cores, no white matte.
- 撞击：4 columns 2 rows; point flash, expanding ripple, bright ring with hexagons, larger electric ring, weakening ring, broken hexagons, dissipating ripple, sparse particles.
- 前景：three detailed dark graphite asteroid rocks concentrated lower left, cool blue rim light, craters, empty transparent center and right, no planet or stars.

基础检查使用 macOS sips 验证尺寸及 Alpha 通道存在；不等同于逐像素透明边缘验收。Python Pillow 不可用，未借此处理图片。爆炸及波纹仍有光晕残留，实际观感以桌面截图和试玩为准。
