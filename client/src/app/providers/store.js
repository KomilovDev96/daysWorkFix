import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../../entities/user/model/authSlice.js';

export const store = configureStore({
    reducer: {
        auth: authReducer,
    },
});
