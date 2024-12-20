import config from '../config/api';

// 将图片转换为base64
const imageToBase64 = (filePath) => {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: res => {
        resolve(res.data);
      },
      fail: err => {
        reject(err);
      }
    });
  });
};

// 基础API请求函数
const makeRequest = (url, data) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method: 'POST',
      header: config.HEADERS,
      data,
      success: (res) => {
        console.log('请求成功:', res);
        if (res.statusCode === 200) {
          resolve(res.data);
        } else {
          reject(new Error(`请求失败: ${res.statusCode} - ${JSON.stringify(res.data)}`));
        }
      },
      fail: (err) => {
        console.error('请求错误:', err);
        reject(err);
      }
    });
  });
};

// 调用GPT-4V进行分析
const analyzeHandwriting = async (base64Image) => {
  try {
    const requestData = {
      model: config.MODEL,
      messages: [
        {
          role: "system",
          content: `你是一位经验丰富的中文书法教育专家，擅长评价各个年龄段的书写作品。请严格按照以下格式分析图片中的手写字体：

### 年龄段判断
请从以下选项中选择一个最匹配的年龄段：
- 小学低年级（1-3年级）
- 小学高年级（4-6年级）
- 初中阶段
- 高中阶段
- 成年阶段

### 专业评价
请从以下四个维度进行评价：

1. **基本笔画**：
   - 横、竖、撇、捺、点等笔画的规范性
   - 笔画的力度和流畅度

2. **结构布局**：
   - 字的大小均匀性
   - 间距控制情况
   - 行距把握情况

3. **书写习惯**：
   - 笔顺正确性
   - 运笔连贯性
   - 书写速度把控

4. **整体美感**：
   - 字体的协调性
   - 美观度评价
   - 清晰度评价

### 总体评分
请给出1-100分的评分，并说明评分依据。

### 改进建议
请给出3-5条具体的改进建议。

### 练字方法建议
请根据年龄段特点，给出3-4条适合的练字方法。`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请对这张图片中的手写字体进行专业评价。"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    };

    console.log('发送分析请求数据:', requestData);
    
    const response = await makeRequest(
      `${config.API_BASE_URL}/chat/completions`,
      requestData
    );
    
    console.log('分析响应数据:', response);
    return parseAIResponse(response.choices[0].message.content);

  } catch (error) {
    console.error('分析失败:', error);
    throw error;
  }
};

// 解析AI返回的评价内容
const parseAIResponse = (aiResponse) => {
  try {
    console.log('解析AI响应:', aiResponse);

    // 提取年龄段判断
    const ageMatch = aiResponse.match(/年龄段判断[\s\S]*?\n([^#\n]+)/);
    const ageGroup = ageMatch ? ageMatch[1].trim() : '未知';

    // 提取分数和评分说明
    const scoreSection = aiResponse.match(/总体评分\n(\d+)分。([^#]+)/);
    const score = scoreSection ? parseInt(scoreSection[1]) : 0;

    // 提取专业评价内容
    const comments = [];
    const evaluationSection = aiResponse.match(/专业评价([\s\S]*?)(?=###\s*总体评分)/);
    
    if (evaluationSection) {
      const dimensions = evaluationSection[1].split(/\d+\.\s+\*\*([^*]+)\*\*/);
      for (let i = 1; i < dimensions.length; i += 2) {
        if (dimensions[i] && dimensions[i + 1]) {
          const category = dimensions[i].trim();
          const points = dimensions[i + 1]
            .split(/\s*-\s*/)
            .filter(point => point.trim())
            .map(point => point.trim())
            .filter(point => point.length > 0);
            
          if (points.length > 0) {
            comments.push(`${category}：${points.join('；')}`);
          }
        }
      }
    }

    // 提取改进建议
    const suggestionsSection = aiResponse.match(/改进建议([\s\S]*?)(?=###\s*练字方法|$)/);
    const suggestions = suggestionsSection ? suggestionsSection[1]
      .split(/\d+\.\s+/)
      .slice(1)
      .map(s => s.trim())
      .filter(s => s.length > 0) : [];

    // 提取练字方法
    const methodsSection = aiResponse.match(/练字方法建议([\s\S]*?)(?=###|$)/);
    const methods = methodsSection ? methodsSection[1]
      .split(/\d+\.\s+/)
      .slice(1)
      .map(s => s.trim())
      .filter(s => s.length > 0) : [];

    const result = {
      ageGroup,
      score,
      comments,
      suggestions,
      methods,
      rawResponse: aiResponse
    };

    // 验证结果完整性
    const isValid = (
      result.ageGroup !== '未知' &&
      result.score > 0 &&
      result.comments.length > 0 &&
      result.suggestions.length > 0
    );

    if (!isValid) {
      return parseAIResponseBackup(aiResponse);
    }

    console.log('解析结果:', result);
    return result;
  } catch (error) {
    console.error('解析失败:', error);
    return parseAIResponseBackup(aiResponse);
  }
};

// 备用解析函数
const parseAIResponseBackup = (aiResponse) => {
  const lines = aiResponse.split('\n').map(line => line.trim());
  
  const result = {
    ageGroup: '未知',
    score: 0,
    comments: [],
    suggestions: [],
    methods: [],
    rawResponse: aiResponse
  };

  let currentSection = '';
  
  lines.forEach(line => {
    if (!line) return;
    
    // 清理行内容
    const cleanLine = line.replace(/\*\*/g, '').replace(/###/g, '').trim();
    
    // 识别当前部分
    if (cleanLine.includes('专业评价')) {
      currentSection = 'evaluation';
    } else if (cleanLine.includes('总体评分')) {
      currentSection = 'score';
    } else if (cleanLine.includes('改进建议')) {
      currentSection = 'suggestions';
    } else if (cleanLine.includes('练字方法')) {
      currentSection = 'methods';
    }
    
    // 根据不同部分处理内容
    if (cleanLine.includes('年龄段') && cleanLine.includes('：')) {
      result.ageGroup = cleanLine.split('：')[1].trim();
    } else if (currentSection === 'score' && cleanLine.match(/\d+分/)) {
      result.score = parseInt(cleanLine.match(/(\d+)分/)[1]);
    } else if (currentSection === 'evaluation' && cleanLine.match(/^[1-4]\./)) {
      const category = cleanLine.split('：')[0].replace(/^\d+\.\s*/, '');
      const content = cleanLine.split('：')[1];
      if (content) {
        result.comments.push(`${category}：${content}`);
      }
    } else if (currentSection === 'suggestions' && cleanLine.match(/^\d+\./)) {
      result.suggestions.push(cleanLine.replace(/^\d+\.\s*/, ''));
    } else if (currentSection === 'methods' && cleanLine.match(/^\d+\./)) {
      result.methods.push(cleanLine.replace(/^\d+\.\s*/, ''));
    }
  });

  return result;
};

// 测试函数
const testAPI = async () => {
  try {
    const testRequestData = {
      model: config.MODEL,
      messages: [
        {
          role: "user",
          content: [
            { 
              type: "text", 
              text: "What's in this image?" 
            },
            {
              type: "image_url",
              image_url: {
                url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    };

    console.log('发送测试请求数据:', testRequestData);
    
    const response = await makeRequest(
      `${config.API_BASE_URL}/chat/completions`,
      testRequestData
    );
    
    console.log('测试响应数据:', response);
    return response;

  } catch (error) {
    console.error('测试失败:', error);
    throw error;
  }
};

export default {
  imageToBase64,
  analyzeHandwriting,
  testAPI
}; 