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
      // 1. 上传图片到云存储
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `handwriting/${Date.now()}.jpg`,
        filePath: this.data.tempImagePath,
      });

      // 2. 调用云函数进行分析
      const analysisResult = await wx.cloud.callFunction({
        name: 'analyzeHandwriting',
        data: {
          fileID: uploadResult.fileID,
        }
      });
      
      // 3. 保存结果并跳转
      wx.setStorageSync('analysisResult', analysisResult.result);
      
      wx.hideLoading();
      this.setData({ analyzing: false });
      
      wx.navigateTo({
        url: '/pages/result/result',
      });
    } catch (err) {
      console.error('分析失败:', err);
      wx.hideLoading();
      this.setData({ analyzing: false });
      
      wx.showToast({
        title: '分析失败，请重试',
        icon: 'error'
      });
    }
  },

  // 上传图片到服务器
  uploadToServer: function(filePath) {
    return new Promise((resolve, reject) => {
      // TODO: 实现真实的上传逻辑
      // 这里暂时模拟上传
      setTimeout(() => {
        resolve({
          imageId: 'test_image_id_' + Date.now()
        });
      }, 1500);
    });
  },

  // 获取分析结果
  getAnalysisResult: function(imageId) {
    return new Promise((resolve, reject) => {
      // TODO: 实现真实的结果获取逻辑
      // 这里暂时模拟结果
      setTimeout(() => {
        resolve({
          score: 85,
          comments: [
            "整体书写工整，结构匀称",
            "笔画连贯，显示出良好的书写习惯",
            "建议注意字间距的把控"
          ]
        });
      }, 1500);
    });
  },

  // 在Page对象中添加测试函数
  testAPICall: async function() {
    try {
      wx.showLoading({
        title: '测试API中...',
      });
      
      const result = await api.testAPI();
      console.log('测试结果:', result);
      
      wx.hideLoading();
      wx.showModal({
        title: '测试结果',
        content: JSON.stringify(result.data, null, 2),
        showCancel: false
      });
    } catch (err) {
      console.error('测试失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '测试失败',
        icon: 'error'
      });
    }
  },
});
