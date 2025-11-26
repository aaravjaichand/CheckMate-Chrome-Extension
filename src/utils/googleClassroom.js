// Google Classroom API utilities
const API_BASE_URL = process.env.GOOGLE_CLASSROOM_API_BASE_URL || 'https://classroom.googleapis.com/v1';

export class GoogleClassroomAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
  }

  setAccessToken(token) {
    this.accessToken = token;
  }

  async apiCall(endpoint) {
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired
        await chrome.storage.local.remove('accessToken');
        throw new Error('SESSION_EXPIRED');
      }
      throw new Error(`API Error: ${response.status}`);
    }

    return response.json();
  }

  async getCourses() {
    const data = await this.apiCall('courses?courseStates=ACTIVE');
    return data.courses || [];
  }

  async getAssignments(courseId) {
    const data = await this.apiCall(`courses/${courseId}/courseWork`);
    return data.courseWork || [];
  }

  async getSubmissions(courseId, courseWorkId) {
    const data = await this.apiCall(
      `courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`
    );
    return data.studentSubmissions || [];
  }

  async getStudentProfile(userId) {
    try {
      const data = await this.apiCall(`userProfiles/${userId}`);
      return data;
    } catch (error) {
      console.error('Error fetching student profile:', error);
      return null;
    }
  }

  async getCourseStudent(courseId, userId) {
    try {
      const data = await this.apiCall(`courses/${courseId}/students/${userId}`);
      return data;
    } catch (error) {
      console.error('Error fetching course student:', error);
      return null;
    }
  }

  /**
   * Get attachments from a submission
   * @param {Object} submission - The submission object from Google Classroom
   * @returns {Array} Array of attachment objects with URLs
   */
  getSubmissionAttachments(submission) {
    const attachments = [];

    if (submission.assignmentSubmission) {
      // Get attachments from assignmentSubmission
      if (submission.assignmentSubmission.attachments) {
        attachments.push(...submission.assignmentSubmission.attachments);
      }
    }

    return attachments.map(att => ({
      type: att.driveFile ? 'driveFile' : att.link ? 'link' : att.youTubeVideo ? 'youTubeVideo' : 'form',
      title: att.driveFile?.title || att.link?.title || att.youTubeVideo?.title || att.form?.title || 'Untitled',
      url: att.driveFile?.alternateLink || att.link?.url || att.youTubeVideo?.alternateLink || att.form?.formUrl,
      thumbnailUrl: att.driveFile?.thumbnailUrl || att.youTubeVideo?.thumbnailUrl,
      id: att.driveFile?.id || att.link?.url || att.youTubeVideo?.id || att.form?.formUrl,
      mimeType: att.driveFile?.mimeType,
      raw: att
    }));
  }
}

// Authentication functions
export async function authenticate() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: 'authenticate' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response) {
        // Response now contains { accessToken, firebaseUser, error? }
        resolve(response);
      } else {
        reject(new Error('Authentication failed'));
      }
    });
  });
}

export async function getStoredToken() {
  const result = await chrome.storage.local.get('accessToken');
  return result.accessToken;
}

export async function getStoredAuthData() {
  const result = await chrome.storage.local.get(['accessToken', 'firebaseUser', 'idToken']);
  return {
    accessToken: result.accessToken,
    firebaseUser: result.firebaseUser,
    idToken: result.idToken
  };
}

export async function storeToken(token) {
  await chrome.storage.local.set({ accessToken: token });
}

export async function storeAuthData(authData) {
  // authData should contain { accessToken, firebaseUser, idToken }
  await chrome.storage.local.set({
    accessToken: authData.accessToken,
    firebaseUser: authData.firebaseUser,
    idToken: authData.idToken
  });
}

export async function clearToken() {
  await chrome.storage.local.remove(['accessToken', 'firebaseUser', 'idToken']);
}
