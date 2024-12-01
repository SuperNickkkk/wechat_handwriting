const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 从环境变量获取配置
const API_KEY = process.env.OPENAI_API_KEY;
const API_BASE_URL = process.env.API_BASE_URL;
const MODEL = process.env.MODEL;

// 配置API请求
const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json'
};

// 主函数
exports.main = async (event, context) => {
  try {
    const { fileID } = event;
    console.log('1. 收到请求参数:', {
      fileID,
      API_BASE_URL,
      MODEL,
      hasAPIKey: !!API_KEY
    });

    // 1. 获取图片访问链接
    console.log('2. 开始获取图片访问链接:', fileID);
    const urlResult = await cloud.getTempFileURL({
      fileList: [fileID]
    });
    
    if (!urlResult.fileList || !urlResult.fileList[0].tempFileURL) {
      throw new Error('获取图片URL失败');
    }
    
    const imageUrl = urlResult.fileList[0].tempFileURL;
    console.log('3. 获取图片URL成功:', imageUrl);
    
    // 构建请求数据
    const requestData = {
      model: MODEL,
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
                url: imageUrl
              }
            }
          ]
        }
      ],
      max_tokens: 2000
    };

    console.log('4. 准备发送API请求:', {
      url: `${API_BASE_URL}/chat/completions`,
      model: MODEL,
      imageUrl: imageUrl.substring(0, 50) + '...'
    });
    
    // 发送API请求
    const response = await axios.post(
      `${API_BASE_URL}/chat/completions`,
      requestData,
      { headers }
    );

    console.log('5. 收到API响应:', {
      status: response.status,
      hasChoices: !!response.data?.choices,
      firstChoice: !!response.data?.choices?.[0],
      hasContent: !!response.data?.choices?.[0]?.message?.content
    });

    // 解析响应
    const aiContent = response.data.choices[0].message.content;
    console.log('6. AI响应原文:', aiContent);

    const analysisResult = parseAIResponse(aiContent);
    console.log('7. 解析后的结果:', analysisResult);
    
    // 保存到数据库
    const db = cloud.database();
    console.log('8. 准备保存到数据库');
    
    const dbResult = await db.collection('analysis_records').add({
      data: {
        fileID,
        result: analysisResult,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        _openid: cloud.getWXContext().OPENID,
        env: cloud.DYNAMIC_CURRENT_ENV
      }
    });
    
    console.log('9. 数据库保存完成:', dbResult);

    return {
      success: true,
      ...analysisResult
    };

  } catch (error) {
    console.error('云函数执行错误:', {
      message: error.message,
      stack: error.stack,
      response: error.response?.data
    });
    
    return {
      success: false,
      error: error.message,
      details: error.response?.data || error.stack
    };
  }
};

// 修改解析函数，添加日志
function parseAIResponse(aiResponse) {
  try {
    console.log('开始解析AI响应，原文长度:', aiResponse.length);

    // 提取年龄段判断
    const ageMatch = aiResponse.match(/年龄段判断[\s\S]*?([^#\n]+)/);
    const ageGroup = ageMatch ? ageMatch[1].trim() : '未知';

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

    // 提取总体评分
    const scoreMatch = aiResponse.match(/总体评分[\s\S]*?(\d+)分/);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;

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

    console.log('解析完成，结果:', result);
    return result;

  } catch (error) {
    console.error('主解析函数失败，使用备用解析:', error);
    return parseAIResponseBackup(aiResponse);
  }
}

// 备用解析函数
function parseAIResponseBackup(aiResponse) {
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
    
    const cleanLine = line.replace(/\*\*/g, '').replace(/###/g, '').trim();
    
    if (cleanLine.includes('年龄段判断')) {
      currentSection = 'age';
    } else if (cleanLine.includes('专业评价')) {
      currentSection = 'evaluation';
    } else if (cleanLine.includes('总体评分')) {
      currentSection = 'score';
    } else if (cleanLine.includes('改进建议')) {
      currentSection = 'suggestions';
    } else if (cleanLine.includes('练字方法')) {
      currentSection = 'methods';
    }
    
    if (currentSection === 'age' && line.includes('-')) {
      result.ageGroup = line.trim().replace('-', '').trim();
    } else if (currentSection === 'score' && line.match(/\d+分/)) {
      result.score = parseInt(line.match(/(\d+)分/)[1]);
    } else if (currentSection === 'evaluation' && line.match(/^\d+\./)) {
      result.comments.push(line.replace(/^\d+\.\s*/, ''));
    } else if (currentSection === 'suggestions' && line.match(/^\d+\./)) {
      result.suggestions.push(line.replace(/^\d+\.\s*/, ''));
    } else if (currentSection === 'methods' && line.match(/^\d+\./)) {
      result.methods.push(line.replace(/^\d+\.\s*/, ''));
    }
  });

  return result;
} 