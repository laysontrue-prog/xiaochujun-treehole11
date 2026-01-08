const axios = require('axios');
const FormData = require('form-data');

// ImgBB API Key (从环境变量获取)
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

/**
 * 处理图片上传
 * @param {string} base64Image - 前端传来的Base64图片字符串 (包含 data:image/xxx;base64, 前缀)
 * @returns {Promise<string>} - 返回图片URL或压缩后的Base64
 */
async function uploadImage(base64Image) {
  // 1. 检查是否为空
  if (!base64Image) return null;

  // 2. 检查大小 (粗略估算：Base64长度 * 0.75 = 字节数)
  const sizeInBytes = base64Image.length * 0.75;
  const sizeInKB = sizeInBytes / 1024;

  console.log(`[ImageHandler] 接收图片，大小: ${sizeInKB.toFixed(2)} KB`);

  // 3. 如果配置了 ImgBB API Key，尝试上传
  if (IMGBB_API_KEY) {
    try {
      console.log('[ImageHandler] 正在上传到 ImgBB...');
      // 移除前缀，只保留 Base64 数据
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
      
      const formData = new FormData();
      formData.append('image', base64Data);

      const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, formData, {
        headers: {
          ...formData.getHeaders()
        }
      });

      if (response.data && response.data.data && response.data.data.url) {
        console.log('[ImageHandler] 上传成功，URL:', response.data.data.url);
        return response.data.data.url; // 返回图床 URL
      }
    } catch (error) {
      console.error('[ImageHandler] ImgBB 上传失败:', error.message);
      // 上传失败降级处理：继续走下面的逻辑
    }
  } else {
    console.log('[ImageHandler] 未配置 IMGBB_API_KEY，使用 Base64 存储');
  }

  // 4. 兜底方案：直接存 Base64
  // 安全检查：如果图片太大且没法上传图床，为了保护数据库，我们要拒绝或截断
  // 这里我们设定一个硬阈值：200KB (MongoDB 文档最大 16MB，但多了会慢)
  if (sizeInKB > 300) {
    throw new Error('图片过大且图床不可用，请压缩至 300KB 以下');
  }

  return base64Image;
}

module.exports = { uploadImage };