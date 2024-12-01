// portfolio.js
Page({
  data: {
    works: [
      { id: 1, title: "春天的风", author: "小明", likes: 45 },
      { id: 2, title: "夏日荷塘", author: "小红", likes: 38 },
      { id: 3, title: "秋叶飘零", author: "小华", likes: 36 },
      { id: 4, title: "冬雪皑皑", author: "小芳", likes: 32 },
      { id: 5, title: "山水如画", author: "小强", likes: 19 },
    ],
    featuredWork: null
  },

  onLoad: function() {
    this.updateFeaturedWork();
  },

  updateFeaturedWork: function() {
    // 获取点赞数最多的作品作为热门作品
    const sortedWorks = [...this.data.works].sort((a, b) => b.likes - a.likes);
    this.setData({
      featuredWork: sortedWorks[0]
    });
  },

  handleLike: function(e) {
    const id = e.currentTarget.dataset.id;
    const works = this.data.works.map(work => 
      work.id === id ? { ...work, likes: work.likes + 1 } : work
    );
    
    this.setData({ works }, () => {
      this.updateFeaturedWork();
    });
  },

  goBack: function() {
    wx.navigateBack();
  }
}); 