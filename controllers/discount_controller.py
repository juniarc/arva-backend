from flask import jsonify, request, Blueprint
from connector.db import db
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models.discount import Discount
from models.products import Product
from datetime import datetime

discount_bp = Blueprint('discount_controller', __name__)


@discount_bp.route('/getdiscount/<int:discount_id>', methods=['GET'])
def get_discount(discount_id):
    try:
        discount = db.session.query(Discount).filter_by(discount_id=discount_id).first()
        if discount is None:
            return jsonify({'error': 'Discount not found'}), 404
        return jsonify(discount.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get discount'}), 500
    
@discount_bp.route('/getdiscountbyproduct/<int:product_id>', methods=['GET'])
def get_discount_by_product(product_id):
    try:
        discount = db.session.query(Discount).filter_by(product_id=product_id).first()
        if discount is None:
            return jsonify({'error': 'Discount not found'}), 404
        return jsonify(discount.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get discount'}), 500


@discount_bp.route('/creatediscount/<int:product_id>', methods=['POST'])
@jwt_required()
def create_discount(product_id):
    data = request.get_json()
    current_user_id = get_jwt_identity()
    allowed_type =['percentage', 'fixed']
    start_date = datetime.fromisoformat(data['start_date'])
    end_date = datetime.fromisoformat(data['end_date'])

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    required_fields = ['discount_name', 'discount_type', 'discount_value', 'start_date', 'end_date']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing {field}'}), 400
        elif not data[field] or str(data[field]).strip() == "":
            return jsonify({'error': f'{field} cannot be empty'}), 400
    
    if data['discount_type'] not in allowed_type:
        return jsonify({'error': 'Invalid discount type, must be "percentage" or "fixed"'}), 400
    elif data['discount_value'] <= 0:
        return jsonify({'error': 'Discount value must be greater than 0'}), 400
    elif data['discount_type'] == 'percentage' and data['discount_value'] > 100:
        return jsonify({'error': 'Discount value must be less than or equal to 100 for percentage discount'}), 400
    elif start_date > end_date:
        return jsonify({'error': 'Start date must be before end date'}), 400

    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        if data['discount_type'] == 'fixed' and data['discount_value'] > product.price:
            return jsonify({'error': 'Discount value must be less than or equal to product price for fixed discount'}), 400

        new_discount = Discount(
            discount_name=data['discount_name'],
            discount_type=data['discount_type'],
            discount_value=data['discount_value'],
            start_date=start_date,
            end_date=end_date,
            product_id=product_id)
        
        db.session.add(new_discount)
        db.session.commit()
        return jsonify({'message': 'Discount created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create discount'}), 500
    

@discount_bp.route('/updatediscount/<int:discount_id>', methods=['PUT'])
@jwt_required()
def update_discount(discount_id):
    data = request.get_json()
    current_user_id = get_jwt_identity()
    allowed_type =['percentage', 'fixed']
    start_date = datetime.fromisoformat(data['start_date'])
    end_date = datetime.fromisoformat(data['end_date'])


    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    elif data['discount_type'] not in allowed_type:
        return jsonify({'error': 'Invalid discount type, must be "percentage" or "fixed"'}), 400
    elif data['discount_value'] <= 0:
        return jsonify({'error': 'Discount value must be greater than 0'}), 400
    elif data['discount_type'] == 'percentage' and data['discount_value'] > 100:
        return jsonify({'error': 'Discount value must be less than or equal to 100 for percentage discount'}), 400
    elif start_date > end_date:
        return jsonify({'error': 'Start date must be before end date'}), 400
    
    try:
        discount = db.session.query(Discount).filter_by(discount_id=discount_id).first()
        product = db.session.query(Product).filter_by(product_id=discount.product_id).first()
        if discount is None:
            return jsonify({'error': 'Discount not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        if data['discount_type'] == 'fixed' and data['discount_value'] > product.price:
            return jsonify({'error': 'Discount value must be less than or equal to product price for fixed discount'}), 400

        discount.discount_name = data.get('discount_name', discount.discount_name)
        discount.discount_type = data.get('discount_type', discount.discount_type)
        discount.discount_value = data.get('discount_value', discount.discount_value)
        discount.start_date = datetime.fromisoformat(data.get('start_date', discount.start_date))
        discount.end_date = datetime.fromisoformat(data.get('end_date', discount.end_date))

        db.session.commit()
        return jsonify({'message': 'Discount updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update discount'}), 500
    
@discount_bp.route('/deletediscount/<int:discount_id>', methods=['DELETE'])
@jwt_required()
def delete_discount(discount_id):
    current_user_id = get_jwt_identity()

    try:
        discount = db.session.query(Discount).filter_by(discount_id=discount_id).first()
        product = db.session.query(Product).filter_by(product_id=discount.product_id).first()
        if discount is None:
            return jsonify({'error': 'Discount not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401    

        db.session.delete(discount)
        db.session.commit()
        return jsonify({'message': 'Discount deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to delete discount'}), 500