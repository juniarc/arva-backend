from flask import jsonify, request, Blueprint
from connector.db import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models.voucher import Voucher
from models.shops import Shop
from datetime import datetime


voucher_bp = Blueprint('voucher_controller', __name__)


@voucher_bp.route('/getallvouchers', methods=['GET'])
def get_all_voucher():
    try:
        vouchers = db.session.query(Voucher).all()
        return jsonify([voucher.to_dict() for voucher in vouchers]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all vouchers'}), 500
    
@voucher_bp.route('/getvoucher/<int:voucher_id>', methods=['GET'])
def get_voucher(voucher_id):
    try:
        voucher = db.session.query(Voucher).filter_by(voucher_id=voucher_id).first()
        if voucher is None:
            return jsonify({'error': 'Voucher not found'}), 404
        return jsonify(voucher.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get voucher'}), 500
    
@voucher_bp.route('/getvouchershop/<int:shop_id>', methods=['GET'])
def get_voucher_shop(shop_id):
    try:
        vouchers = db.session.query(Voucher).filter(shop_id=shop_id).all()

        return jsonify([voucher.to_dict() for voucher in vouchers]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get voucher'}), 500
    
@voucher_bp.route('/createvoucher', methods=['POST'])
@jwt_required()
def create_voucher():
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    allowed_type =['percentage', 'fixed']
    required_fields = ['voucher_name', 'voucher_type', 'voucher_value', 'start_date', 'end_date', 'shop_id']
    
    if data is None:
        return jsonify({'error': 'No data provided'}), 400
        
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing {field}'}), 400
        elif not data[field] or str(data[field]).strip() == "":
            return jsonify({'error': f'{field} cannot be empty'}), 400
    
    if data['voucher_type'] not in allowed_type:
        return jsonify({'error': 'Invalid voucher type, must be "percentage" or "fixed"'}), 400
    elif data['voucher_value'] <= 0:
        return jsonify({'error': 'Voucher value must be greater than 0'}), 400
    elif data['voucher_type'] == 'percentage' and data['voucher_value'] > 100:
        return jsonify({'error': 'Voucher value must be less than or equal to 100 for percentage voucher'}), 400

    try:
        data = request.get_json()
        voucher_name = data.get('voucher_name')
        voucher_type = data.get('voucher_type')
        voucher_value = data.get('voucher_value')
        start_date = datetime.fromisoformat(data['start_date'])
        end_date = datetime.fromisoformat(data['end_date'])
        shop_id = data.get('shop_id')
        shop = db.session.query(Shop).filter_by(shop_id=shop_id).first()
        
        if shop is None or shop.status != 'active':
            return jsonify({'error': 'Shop not found'}), 404
        elif shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        elif start_date >= end_date:
            return jsonify({'error'})
        
        voucher = Voucher(voucher_name=voucher_name, voucher_type=voucher_type, voucher_value=voucher_value, start_date=start_date, end_date=end_date, shop_id=shop_id)
        db.session.add(voucher)
        db.session.commit()
        return jsonify({'message': 'Voucher created successfully','voucher_id': voucher.voucher_id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create voucher'}), 500
    
    
@voucher_bp.route('/updatevoucher/<int:voucher_id>', methods=['PUT'])
@jwt_required()
def update_voucher(voucher_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    allowed_type =['percentage', 'fixed']
    voucher_type = data.get('voucher_type', voucher.voucher_type)
    voucher_value = data.get('voucher_value', voucher.voucher_value)
    

    if data is None:
        return jsonify({'error': 'No data provided'}), 400


    try:
        voucher = db.session.query(Voucher).filter_by(voucher_id=voucher_id).first()

        if voucher is None:
            return jsonify({'error': 'Voucher not found'}), 404
        elif voucher.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        
        
        start_date = data.get('start_date', voucher.start_date)
        end_date = data.get('end_date', voucher.end_date)

        try:
            voucher.start_date =  datetime.fromisoformat(start_date)
            voucher.end_date = datetime.fromisoformat(end_date)
        except ValueError:
            return jsonify({'error': 'Invalid date format, must be ISO format'}), 400

    
        voucher.voucher_name = data.get('voucher_name', voucher.voucher_name)
        voucher.voucher_type = data.get('voucher_type', voucher.voucher_type)
        voucher.voucher_value = data.get('voucher_value', voucher.voucher_value)

        if voucher_type not in allowed_type:
            return jsonify({'error': 'Invalid voucher type, must be "percentage" or "fixed"'}), 400
        elif voucher_value <= 0:
            return jsonify({'error': 'Voucher value must be greater than 0'}), 400
        elif voucher_type == 'percentage' and voucher_value > 100:
            return jsonify({'error': 'Voucher value must be less than or equal to 100 for percentage voucher'}), 400
        elif start_date >= end_date:
            return jsonify({'error': 'Start date must be earlier than end date'}), 400

        db.session.commit()
        return jsonify({'message': 'Voucher updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update voucher'}), 500
   

@voucher_bp.route('/deletevoucher/<int:voucher_id>', methods=['DELETE'])
@jwt_required()
def delete_voucher(voucher_id):
    current_user_id = int(get_jwt_identity())
    try:
        voucher = db.session.query(Voucher).filter_by(voucher_id=voucher_id).first()
        if voucher is None:
            return jsonify({'error': 'Voucher not found'}), 404
        elif voucher.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        db.session.delete(voucher)
        db.session.commit()
        return jsonify({'message': 'Voucher deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete voucher'}), 500