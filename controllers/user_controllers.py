from flask import Blueprint, request, jsonify
from models.users import User
from flask_jwt_extended import create_access_token
from connector.db import db
import datetime


user_bp = Blueprint('user_controller', __name__)

@user_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'username' not in data:
        return jsonify({'error': 'Missing username'}), 400
    elif 'email' not in data:
        return jsonify({'error': 'Missing email'}), 400
    elif 'password' not in data:
        return jsonify({'error': 'Missing password'}), 400
    elif 'phone_number' not in data:
        return jsonify({'error': 'Missing phone number'}), 400
    elif 'role' not in data:
        return jsonify({'error': 'Missing role'}), 400


    try:
        user = User(username=data['username'], email=data['email'], phone_number=data['phone_number'], role=data['role'])
        user.set_password(data['password'])
        db.session.add(user)
        db.session.commit()
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to register user'}), 500

@user_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif 'email' not in data:
        return jsonify({'error': 'Missing email'}), 400 
    elif 'password' not in data:
        return jsonify({'error': 'Missing password'}), 400

    
    try:
        user = db.session.query(User).filter_by(email=data['email']).first()
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        if not user.check_password(data['password']):
            return jsonify({'error': 'Incorrect password'}), 401
        if user and user.check_password(data['password']):
            expires = datetime.timedelta(minutes=60)
            access_token = create_access_token(identity={
                'user_id': user.user_id,
                'username': user.username,
                'email': user.email,
                'role': user.role
            }, expires_delta=expires)
            return jsonify({'message': f'User {user.username} Logged in successfully',
                'access_token': access_token}), 200

    except Exception as e:
        return jsonify({'error': 'Failed to login'}), 500
        
@user_bp.route('/allusers', methods=['GET'])
def get_all_users():

    try:
        users = db.session.query(User).all()
        return jsonify([user.to_dict() for user in users]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all users'}), 500

@user_bp.route('/<int:user_id>', methods=['GET'])
def get_user(user_id):
    try:
        user = db.session.query(User).filter_by(user_id=user_id).first()
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        return jsonify(user.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get user'}), 500

@user_bp.route('/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.get_json()
    try:
        user = db.session.query(User).filter_by(user_id=user_id).first()
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        user.username = data.get('username', user.username)
        user.email = data.get('email', user.email)
        user.password = data.get('password', user.password)
        user.phone_number = data.get('phone_number', user.phone_number)
        user.address_street = data.get('address_street', user.address_street)
        user.city = data.get('city', user.city)
        user.state = data.get('state', user.state)
        user.zip_code = data.get('zip_code', user.zip_code)
        user.role = data.get('role', user.role)
        user.profile_image = data.get('profile_image', user.profile_image)
        db.session.commit()
        return jsonify({'message': 'User updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update user'}), 500


@user_bp.route('/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        user = db.session.query(User).filter_by(user_id=user_id).first()
        if user is None:
            return jsonify({'error': 'User not found'}), 404
        db.session.delete(user)  
        db.session.commit()
        return jsonify({'message': 'User deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to delete user'}), 500





