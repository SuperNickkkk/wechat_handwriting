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

    // 标准化年龄段映射
    const AGE_GROUPS = {
      '小学低年级': '小学低年级（1-3年级）',
      '小学高年级': '小学高年级（4-6年级）',
      '初中': '初中阶段',
      '高中': '高中阶段',
      '成年': '成年阶段'
    };

    // 提取年龄段判断
    const ageMatch = aiResponse.match(/年龄段[判断：:]\s*[\n]*([\s\S]*?)(?=###|专业评价|$)/i);
    let ageGroup = '未知';
    if (ageMatch) {
      const ageText = ageMatch[1].trim();
      // 遍历标准年龄段进行匹配
      for (const [key, value] of Object.entries(AGE_GROUPS)) {
        if (ageText.includes(key)) {
          ageGroup = value;
          break;
        }
      }
    }

    // 提取分数
    const scoreMatch = aiResponse.match(/总体评分[：:]\s*[\n]*(\d+)[\s]*分/);
    const score = scoreMatch ? Math.min(Math.max(parseInt(scoreMatch[1]), 0), 100) : 0;

    // 提取评价内容
    const comments = [];
    const DIMENSIONS = ['基本笔画', '结构布局', '书写习惯', '整体美感'];
    
    // 提取专业评价部分
    const evaluationSection = aiResponse.match(/专业评价[\s\S]*?(?=###\s*总体评分|$)/i);
    if (evaluationSection) {
      DIMENSIONS.forEach(dimension => {
        const dimensionMatch = evaluationSection[0].match(
          new RegExp(`\\*\\*${dimension}\\*\\*[：:]([\s\S]*?)(?=\\*\\*|###|$)`)
        );
        if (dimensionMatch) {
          const details = dimensionMatch[1]
            .split(/[-•]/)
            .map(item => item.replace(/\*\*/g, '').trim())
            .filter(item => item && item.length > 2)
            .join('；');
          
          if (details) {
            comments.push(`${dimension}：${details}`);
          }
        }
      });
    }

    // 提取改进建议
    const suggestionsMatch = aiResponse.match(/改进建议[：:]([\s\S]*?)(?=###|练字方法|$)/i);
    const suggestions = suggestionsMatch ? suggestionsMatch[1]
      .split(/\d+\.\s*/)
      .slice(1)
      .map(s => s.replace(/\*\*/g, '').trim())
      .filter(s => s && s.length > 5) : [];

    // 提取练字方法
    const methodsMatch = aiResponse.match(/练字方法[建议：:]([\s\S]*?)(?=###|$)/i);
    const methods = methodsMatch ? methodsMatch[1]
      .split(/\d+\.\s*/)
      .slice(1)
      .map(s => s.replace(/\*\*/g, '').trim())
      .filter(s => s && s.length > 5) : [];

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
      result.comments.length >= 2 &&
      result.suggestions.length >= 2 &&
      result.methods.length >= 2
    );

    if (!isValid) {
      // 使用备用解析方法
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
  
  // 基础信息提取
  const result = {
    ageGroup: '未知',
    score: 0,
    comments: [],
    suggestions: [],
    methods: [],
    rawResponse: aiResponse
  };

  lines.forEach(line => {
    if (!line) return;
    
    // 清理行内容
    const cleanLine = line.replace(/\*\*/g, '').replace(/###/g, '').trim();
    
    // 年龄段提取
    if (cleanLine.includes('年龄') || cleanLine.match(/(小学|初中|高中|成年)/)) {
      result.ageGroup = cleanLine.replace(/.*[：:]\s*/, '').trim();
    }
    
    // 分数提取
    const scoreMatch = cleanLine.match(/(\d+)\s*分/);
    if (scoreMatch && !result.score) {
      result.score = Math.min(Math.max(parseInt(scoreMatch[1]), 0), 100);
    }
    
    // 评价内容提取
    if (cleanLine.match(/(笔画|结构|习惯|美感)/)) {
      result.comments.push(cleanLine);
    }
    
    // 建议提取
    if (line.match(/^\d+\./)) {
      if (cleanLine.includes('练习') || cleanLine.includes('注意')) {
        result.suggestions.push(cleanLine.replace(/^\d+\.\s*/, ''));
      } else if (cleanLine.includes('临摹') || cleanLine.includes('观察')) {
        result.methods.push(cleanLine.replace(/^\d+\.\s*/, ''));
      }
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