const { envList } = require("../../envList");
const { QuickStartPoints, QuickStartSteps } = require("./constants");
import api from '../../utils/api';

Page({
  data: {
    knowledgePoints: QuickStartPoints,
    steps: QuickStartSteps,
    tempImagePath: '', // 临时图片路径
    analyzing: false,  // 是否正在分析中
    maxImageSize: 1024 * 1024 * 4, // 最大4MB
  },

  copyCode(e) {
    const code = e.target?.dataset?.code || '';
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '已复制',
        })
      },
      fail: (err) => {
        console.error('复制失败-----', err);
      }
    })
  },

  discoverCloud() {
    wx.switchTab({
      url: '/pages/examples/index',
    })
  },

  gotoGoodsListPage() {
    wx.navigateTo({
      url: '/pages/goods-list/index',
    })
  },

  // 选择图片
  chooseImage: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.handleImageSelected(res.tempFiles[0]);
      },
      fail: (err) => {
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },

  // 拍照
  takePhoto: function() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        this.handleImageSelected(res.tempFiles[0]);
      },
      fail: (err) => {
        wx.showToast({
          title: '拍照失败',
          icon: 'error'
        });
      }
    });
  },

  // 处理选中的图片
  handleImageSelected: async function(file) {
    try {
      wx.showLoading({
        title: '处理中...',
      });

      // 检查图片大小
      if (file.size > this.data.maxImageSize) {
        // 压缩图片
        const compressedPath = await this.compressImage(file.tempFilePath);
        this.setData({ tempImagePath: compressedPath });
      } else {
        this.setData({ tempImagePath: file.tempFilePath });
      }

      wx.hideLoading();
    } catch (err) {
      wx.hideLoading();
      wx.showToast({
        title: '图片处理失败',
        icon: 'error'
      });
    }
  },

  // 压缩图片
  compressImage: function(imagePath) {
    return new Promise((resolve, reject) => {
      wx.compressImage({
        src: imagePath,
        quality: 80,
        success: (res) => {
          resolve(res.tempFilePath);
        },
        fail: (err) => {
          console.error('压缩失败:', err);
          reject(err);
        }
      });
    });
  },

  // 重置图片
  resetImage: function() {
    this.setData({
      tempImagePath: '',
      analyzing: false
    });
  },

  // 上传图片并分析
  uploadImage: async function() {
    if (this.data.analyzing) return;
    
    this.setData({ analyzing: true });
    wx.showLoading({
      title: '正在分析中...',
    });

    try {
      console.log('1. 开始上传图片');
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `handwriting/${Date.now()}.jpg`,
        filePath: this.data.tempImagePath,
      });
      
      console.log('2. 图片上传成功:', uploadResult);

      console.log('3. 调用云函数');
      const analysisResult = await wx.cloud.callFunction({
        name: 'analyzeHandwriting',
        data: {
          fileID: uploadResult.fileID,
        }
      });
      
      console.log('4. 云函数返回结果:', analysisResult);

      // 检查返回结果的结构
      if (!analysisResult.result) {
        throw new Error('未收到分析结果');
      }

      // 保存结果并跳转
      const resultData = {
        ...analysisResult.result,
        imageUrl: this.data.tempImagePath  // 保存图片路径
      };
      
      wx.setStorageSync('analysisResult', resultData);
      
      wx.hideLoading();
      this.setData({ analyzing: false });
      
      // 延迟跳转，确保数据保存完成
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/result/result',
        });
      }, 100);

    } catch (err) {
      console.error('分析失败:', err);
      wx.hideLoading();
      this.setData({ analyzing: false });
      
      wx.showModal({
        title: '分析失败',
        content: err.message || '请重试',
        showCancel: false,
        success: () => {
          // 重置图片
          this.resetImage();
        }
      });
    }
  }
});
