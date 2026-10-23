import mongoose, { Schema, Document } from 'mongoose';

export interface ITask extends Document {
  title: string;
  description?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority?: 'high' | 'medium' | 'low';
  deadline?: string;
  assigneeId?: string; // ID người thực hiện
  projectId: string;
}

const TaskSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String },
    status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
    priority: { type: String, enum: ['high', 'medium', 'low'] },
    deadline: { type: String },
    projectId: { type: String, required: true },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User' }
},
  { timestamps: true }
);

export default mongoose.model<ITask>('Task', TaskSchema);