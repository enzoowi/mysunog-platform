import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

# Data from your 100-sample test
matrix_data = np.array([[46, 4], 
                        [3, 47]])

# Labels for the grid
predicted_labels = ['AI Predicted:\nFIRE', 'AI Predicted:\nNO FIRE']
actual_labels = ['Actual:\nFIRE', 'Actual:\nNO FIRE']

# Set up the graphic
plt.figure(figsize=(7, 5))
sns.set_theme(font_scale=1.2) # Make font bigger

# Create the color-coded heatmap
ax = sns.heatmap(matrix_data, annot=True, fmt='d', cmap='Blues', 
            xticklabels=predicted_labels, yticklabels=actual_labels, 
            annot_kws={"size": 24, "weight": "bold"}, cbar=False)

# Add titles and labels
plt.title('mySunog YOLOv8 Confusion Matrix (n=100)', fontsize=16, pad=20, fontweight='bold')
plt.ylabel('True Camera Environment', fontsize=14, fontweight='bold')
plt.xlabel('AI Model Prediction', fontsize=14, fontweight='bold')

# Adjust layout and save the image headless
plt.tight_layout()
plt.savefig('confusion_matrix_graphic.png', dpi=300)
print("SUCCESS: confusion_matrix_graphic.png has been generated!")
