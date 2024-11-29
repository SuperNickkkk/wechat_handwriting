// pages/result/result.js
Page({

  /**
   * 页面的初始数据
   */
  data: {
    result: null,
    loading: true
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    try {
      const result = wx.getStorageSync('analysisResult');
      console.log('获取到的评价结果:', result);
      
      if (result) {
        this.setData({
          result: result,
          loading: false
        });
      } else {
        throw new Error('No result found');
      }
    } catch (err) {
      console.error('获取结果失败:', err);
      this.setData({ 
        loading: false,
        error: '获取结果失败，请返回重试'
      });
      wx.showToast({
        title: '获取结果失败',
        icon: 'error'
      });
    }
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {

  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {

  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {

  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {

  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {

  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {

  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {

  },

  backToHome: function() {
    wx.navigateBack({
      delta: 1
    });
  }
})